'use strict';

const sizeof = require('object-sizeof');
const Promise = require('bluebird');
const promiseRetry = require('promise-retry');
const config = require('./../config');
const Atom = require('./atom.class');
const LocalStore = require('./storage/local.class');
const TAG = 'TRACKER';

class Tracker {
  /**
   * This class implements a tracker for tracking events to ironSource atom
   * @param {Object} params
   * @param {Number} [params.flushInterval=10 seconds] - Data sending interval (in seconds)
   * @param {Number} [params.bulkLen=1000] - Number of records in each bulk request
   * @param {Number} [params.bulkSize=128kb] - The maximum bulk size in KB.
   * @param {callback} [params.onError=See Readme] - Callback that will be invoked with the failed event if maximum retries fail
   * @param {Boolean} [params.flushOnExit=true] - Whether all data should be flushed on application exit
   * @param {Object} [params.logger=console] - Override Logger module
   * @param {Object} [params.backlog=LocalStore] - Backlog module, implementation for the tracker backlog storage
   * @ppram {Number} [params.concurrency=10] - Number of requests to send concurrently (Promise.Map)
   * @param {Object} [params.retryOptions] - node-retry(https://github.com/tim-kos/node-retry) options
   * @param {Number} [params.retryOptions.retries=10] - The maximum amount of times to retry the operation.
   * @param {Boolean} [params.retryOptions.randomize=true] - Randomizes the timeouts by multiplying with a factor between 1 to 2.
   * @param {Number} [params.retryOptions.factor=2] - The exponential factor to use.
   * @param {Number} [params.retryOptions.minTimeout=1 second] - The number of milliseconds before starting the first retry.
   * @param {Number} [params.retryOptions.maxTimeout=25 minutes] - The maximum number of milliseconds between two retries.
   * @param {Boolean} [params.debug=false] - Enabled/Disable debug printing
   * Optional for Atom main object:
   * @param {String} [params.endpoint] - Endpoint api url
   * @param {String} [params.auth] - Key for hmac authentication
   * @param {Number} [params.backlogSize] - Size of tracker backlog
   * @param {Number} [params.maxInFlight] - Number of concurrent requests in flight.
   * @constructor
   */
  constructor(params) {
    params = params || {};
    this.params = params || {};

    this.params.debug = typeof params.debug !== 'undefined' ? params.debug : config.DEBUG;
    this.logger = params.logger || config.LOGGER;
    if (typeof this.logger.toggleLogger === "function") {
      this.logger.toggleLogger(this.params.debug);
    }
    this.backlog = params.backlog || new LocalStore(params.backlogSize || config.BACKLOG_SIZE);
    let self = this;

    // Flush logic parameters

    if (typeof params.flushInterval != 'undefined') {
      if (params.flushInterval < 1) {
        this.logger.error(`[${TAG}] Invalid FlushInterval, must be bigger than 1, setting it to ${config.FLUSH_INTERVAL / 1000} seconds`);
        this.params.flushInterval = config.FLUSH_INTERVAL;
      } else {
        this.params.flushInterval = params.flushInterval * 1000;
      }
    } else {
      this.params.flushInterval = config.FLUSH_INTERVAL;
    }

    if (typeof params.bulkLen != 'undefined') {
      // Above or under the limit
      if (params.bulkLen > config.BULK_LENGTH_LIMIT || params.bulkLen < 1) {
        this.logger.error(`[${TAG}] Invalid Bulk length, must between 1 to ${config.BULK_LENGTH_LIMIT}, setting it to ${config.BULK_LENGTH}`);
        this.params.bulkLen = config.BULK_LENGTH;
      } else {
        this.params.bulkLen = params.bulkLen;
      }
    } else {
      this.params.bulkLen = config.BULK_LENGTH;
    }

    if (typeof params.bulkSize != 'undefined') {
      // Above or under the limit
      if (params.bulkSize > config.BULK_SIZE_LIMIT || params.bulkSize < 1) {
        this.logger.error(`[${TAG}] Invalid Bulk size, must between 1KB to ${config.BULK_SIZE_LIMIT}KB, setting it to ${config.BULK_SIZE}KB`);
        this.params.bulkSize = config.BULK_SIZE;
      } else {
        this.params.bulkSize = params.bulkSize * 1024;
      }
    } else {
      this.params.bulkSize = config.BULK_SIZE;
    }

    /* istanbul ignore next */
    this.params.onError = params.onError || function (err, data) {
        self.logger.error(`[${TAG}] onError message: ${err.message}, status: ${err.status} data: ${JSON.stringify(data)}`);
      };
    this.params.flushOnExit = typeof params.flushOnExit !== 'undefined' ? params.flushOnExit : true;

    // Processing parameters
    this.params.concurrency = params.concurrency || config.CONCURRENCY;

    // Retry parameters for exponential backoff
    this.retryOptions = Object.assign({}, {
      retries: 10,
      randomize: true,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 25 * 60 * 60
    }, params.retryOptions);

    this.atom = new Atom(params);
    this.lastFlush = Tracker._getTimestamp();
    this.start();

    if (this.params.flushOnExit) {
      this.exitHandled = false;
      ['exit', 'SIGINT', 'SIGHUP', 'SIGQUIT', 'SIGABRT', 'SIGTERM']
        .map((e) => {
          process.on(e, () => this._exitHandler())
        });
    }

    // "Semaphore" pattern limit for in-flight requests
    this.params.maxInFlight = params.maxInFlight || config.REQUESTS_IN_FLIGHT;
    this.inFlight = 0;
  }

  start() {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    // Run forever and check if we can flush
    this.processStreams = setInterval(() => {
      this._flush();
    }, 500);
  }

  stop() {
    this._exitHandler();
  }

  // todo: Make the tracker emit an on-stop event to drain the backlog
  // and in order to know when it's empty (used from outside)

  /**
   * Handles graceful shutdown of the Tracker
   * @private
   */
  _exitHandler() {
    // Prevent multiple exit handlers to be called
    if (!this.exitHandled) {
      this.exitHandled = true;
      this.logger.info(`[${TAG}] Triggered flush due to exit handler`);
      this._flush(true).then(_ => {
        this.isRunning = false;
        clearInterval(this.processStreams);
      });
    }
  }

  /**
   * Get current time
   * @return {number}
   * @static
   */
  static _getTimestamp() {
    return +new Date();
  }

  /**
   * Return true if flushInterval has been reached.
   * @return {Boolean}
   * @private
   */
  _shouldTriggerIntervalFlush() {
    // console.log("trigger flush:", Tracker._getTimestamp() - this.lastFlush);
    return this.params.flushInterval <= (Tracker._getTimestamp() - this.lastFlush);
  }

  /**
   * Determines whether the stream should be flushed based on 3 conditions
   * 1. Payload length reached
   * 2. Payload size reached
   * 3. Time since last flush
   * @param {String} stream - Atom Stream name
   * @returns {boolean} - Whether the stream should be flushed
   * @private
   */
  _shouldFlush(stream) {
    // console.log("should flush", stream);
    let payload = this.backlog.get(stream);
    // console.log("payload:", payload.length);
    return payload.length && // First, we should not flush an empty array
      (
        payload.length >= this.params.bulkLen || // Flush if we reached desired length (amount of events)
        sizeof(payload) >= this.params.bulkSize || // Flush if the object has reached desired byte-size
        this._shouldTriggerIntervalFlush() // Should trigger based on interval
      );
  }

  /**
   * Track data to Atom, this function returns a Promise which will be resolved only when data is tracked to backlog.
   * The function rejects the promise in 2 cases: 1. Stream / Data are missing, Tracker has been stopped.
   * @param stream - Atom stream name
   * @param data - Data to track
   * @returns Promise
   * @example Tracker Example
   *
   * const AtomTracker = require('atom-node').Tracker;
   * var params = {
   *    auth: "YOUR_HMAC_AUTH_KEY", // Optional, depends on your stream config
   *    flushInterval: 10, // Optional, Tracker flush interval in seconds
   *    bulkLen: 50, // Optional, Number of events per bulk (batch)
   *    bulkSize: 20 // Optional, Size of each bulk in KB
   * }
   * let tracker = new AtomTracker(params);
   * var stream = "MY_STREAM_NAME", // Your target stream name
   * var data = {id: 1, string_col: "String"} // Data that matches your DB structure
   * yield tracker.track(stream, data); // Start tracking and empty on the described above conditions
   *
   * // With promise flow control:
   * Promise.map(someArrayWithEvents, function (data) {
   *  return tracker.track("STREAM NAME", data)
   *    .catch(function (err) {
   *    // Handle error here
   *  });
   * }, concurrency: 1}).then(function (data) {
   *   // By default data will be an array like this: [true, true...]
   * }).catch(function (err) {
   *    console.log(`error happened: ${err}`);
   * });
   */
  track(stream, data) {
    return new Promise((resolve, reject) => {
      // todo: make sure it works (calls on error) and edit the docs
      // if (stream === undefined || stream.length == 0 || data === undefined || data.length == 0) {
      //   return reject(new Error('Stream name and data are required parameters'));
      // }
      if (!this.isRunning) {
        return reject(new Error("Tracker has been stopped. Use tracker.start() to start it"));
      }
      // Can't track for any reason
      if (!this._track(stream, data)) {
        let retry_interval = setInterval(_ => {
          if (this._track(stream, data)) {
            resolve(true);
            clearInterval(retry_interval);
          }
        }, 500);
      } else {
        resolve(true);
      }
    });
  }

  /**
   * Track data to backlog only if: 1. We didn't reach inFlight limit & we didn't reach the backlog limit.
   * @param stream - Atom stream name
   * @param data - Data to track
   * @returns {boolean}
   * @private
   */
  _track(stream, data) {
    return !this._isMaxRequestsInFlight() && this.backlog.add(stream, data);
  }

  /**
   * Returns true if reached max requests at the same time, else false.
   * @returns {boolean}
   * @private
   */
  _isMaxRequestsInFlight() {
    return this.inFlight >= this.params.maxInFlight;
  }

  /**
   * Process all streams and flush if necessary
   * @param forceFlushAll - force flush all streams
   * @param forceFlushStream - stream To Flush
   * @returns {*|Array|Promise}
   * @private
   */
  _flush(forceFlushAll, forceFlushStream) {
    // console.log("process:", forceFlushAll, forceFlushStream);
    return Promise.map(this.backlog.keys, (stream) => {
      // Force flush all streams or a certain stream
      if ((forceFlushAll || (forceFlushStream && forceFlushStream == stream)) && !this.backlog.isEmpty(stream)) {
        console.log("force flush")
        // this.logger.info(`[${TAG}] flushing stream: ${batchStream} with ${this.backlog.get(batchStream).length} items`);
        return this._send(stream, this.backlog.take(stream));
      } else if (!this._isMaxRequestsInFlight() && this._shouldFlush(stream)) {
        console.log("flush stream", this._shouldFlush(stream));
        return this._send(stream, this.backlog.take(stream, config.BULK_LENGTH));
      }
      return false;
    }, {concurrency: this.params.concurrency});
  }

  /**
   * Flush data to Atom, this function returns a promise with array of server responses.
   * Case of error it will not reject the Promise, instead it will call the Tracker onError func.
   * @param [batchStream]
   * @returns Promise
   * @example Flush Example
   *
   * const AtomTracker = require('atom-node').Tracker;
   * let tracker = new Tracker(params);
   *
   * // Flush all data
   * tracker.flush()
   *
   * // Flush all data and get array of results
   * tracker.flush().then((data) => {
   *    console.log("[TRACKER EXAMPLE] Example tracker results:", data);
   * });
   *
   * // Flush a specific stream:
   * tracker.flush("MY_STREAM");
   */
  flush(batchStream) {
    //todo: update doc
    if (!this.isRunning) {
      return reject(new Error("Tracker has been stopped. Use tracker.start() to start it"));
    }
    return typeof batchStream != "undefined" ? this._flush(false, batchStream) : this._flush(true);
  }

  /**
   * Sends events to Atom using Atom Class, handles retries and calls a callback on error
   * @param stream - Atom Stream Name
   * @param data - Data to track
   * @returns {*|Promise.<T>}
   * @private
   */
  _send(stream, data) {
    let payload = {stream: stream, data: data};
    // todo: inFlight fix
    console.log("send", ++this.inFlight);
    console.log("data length in send", data.length);
    this.lastFlush = Tracker._getTimestamp();
    return promiseRetry((retry, number) => {
      return this.atom.putEvents(payload)
        .then((response) => {
          this.logger.debug(`[${TAG}] attempt: #${number}, stream: '${stream}', sent events: ${payload.data.length} - completed successfully`);
          if (--this.inFlight <= 0) {
            this.inFlight = 0;
          }
          return response;
        })
        .catch((err) => {
          this.logger.debug(`[${TAG}] flush attempt #${number} for stream: '${stream}' failed due to "${err.message}" (status ${err.status})`);
          if (err.status >= 500) {
            retry({msg: err, data: payload})
          } else {
            /* istanbul ignore next */
            throw {msg: err, data: payload}
          }
        });
    }, this.retryOptions).then(Promise.resolve)
      .catch((err) => {
        if (--this.inFlight <= 0) {
          this.inFlight = 0;
        }
        this.params.onError(err.msg, err.data);
        // Convert AtomError to regular JS Error
        // return Promise.reject(new Error(`msg: ${err.msg.message} - status: ${err.msg.status}`));
      });
  }
}

module.exports = Tracker;