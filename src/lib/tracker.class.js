'use strict';

const sizeof = require('object-sizeof');
const Promise = require('bluebird');
const promiseRetry = require('promise-retry');
const config = require('./../config');
const Atom = require('./atom.class');
const LocalStore = require('./storage/local.class');
const TAG = 'TRACKER';
const EventEmitter = require('events');

class Tracker extends EventEmitter {
  /**
   * This class implements a tracker for tracking events to IronSource Atom
   * @param {Object}   params
   * @param {Number}   [params.flushInterval=10 seconds] - Data sending interval (in seconds)
   * @param {Number}   [params.bulkLen=250] - Max Number of records in each bulk request
   * @param {Number}   [params.bulkSize=128kb] - Maximum bulk size in KB.
   * @param {Number}   [params.backlogSize=2000] - Size of tracker backlog
   * @param {Number}   [params.maxInFlight] - Number of concurrent requests in flight.
   * @param {Object}   [params.logger=console] - Override Logger module
   * @param {Object}   [params.backlog=LocalStore] - Backlog module, implementation for the tracker backlog storage
   * @param {Number}   [params.concurrency=2] - Number of requests to send concurrently per stream (Promise.Map)
   * @param {Boolean}  [params.debug=false] - Enabled/Disable debug printing
   * @param {Boolean}  [params.isBlocking=true] - Should the .track() method block the caller (won't block the process)
   * @param {Number}   [params.trackingTimeout=10 seconds] - Tracking timeout in seconds, ignored if isBlocking=true
   * @param {Object}   [params.retryOptions] - node-retry(https://github.com/tim-kos/node-retry) options
   * @param {Number}   [params.retryOptions.retries=10] - The maximum amount of times to retry the operation.
   * @param {Boolean}  [params.retryOptions.randomize=true] - Randomizes the timeouts by multiplying with a factor between 1 to 2.
   * @param {Number}   [params.retryOptions.factor=2] - The exponential factor to use.
   * @param {Number}   [params.retryOptions.minTimeout=1 second] - The number of milliseconds before starting the first retry.
   * @param {Number}   [params.retryOptions.maxTimeout=25 minutes] - The maximum number of milliseconds between two retries.
   * Optional for Atom main class:
   * @param {String}   [params.endpoint] - Endpoint api url
   * @param {String}   [params.auth] - Key for hmac authentication
   * @constructor
   */
  constructor(params) {
    super();

    params = params || {};
    this.params = params || {};
    this.params.debug = typeof params.debug !== 'undefined' ? params.debug : config.DEBUG;
    this.params.isBlocking = typeof params.isBlocking !== 'undefined' ? params.isBlocking : config.IS_BLOCKING;
    this.logger = params.logger || config.LOGGER;
    if (typeof this.logger.toggleLogger === "function") {
      this.logger.toggleLogger(this.params.debug);
    }
    this.backlog = params.backlog || new LocalStore(params.backlogSize || config.BACKLOG_SIZE);

    // Flush logic parameters

    if (typeof params.trackingTimeout !== 'undefined') {
      if (params.trackingTimeout < 1) {
        this.logger.error(`[${TAG}] Invalid trackingTimeout, must be >= 1 second, setting default: ${config.TRACKING_TIMEOUT / 1000} seconds`);
        this.params.trackingTimeout = config.TRACKING_TIMEOUT;
      } else {
        this.params.trackingTimeout = params.trackingTimeout * 1000;
      }
    } else {
      this.params.trackingTimeout = config.TRACKING_TIMEOUT;
    }

    if (typeof params.flushInterval !== 'undefined') {
      if (params.flushInterval < 1) {
        this.logger.error(`[${TAG}] Invalid FlushInterval, must be => 1, setting it to ${config.FLUSH_INTERVAL / 1000} seconds`);
        this.params.flushInterval = config.FLUSH_INTERVAL;
      } else {
        this.params.flushInterval = params.flushInterval * 1000;
      }
    } else {
      this.params.flushInterval = config.FLUSH_INTERVAL;
    }

    if (typeof params.bulkLen !== 'undefined') {
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

    if (typeof params.bulkSize !== 'undefined') {
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

    // Processing parameters
    this.params.concurrency = params.concurrency || config.CONCURRENCY;

    // Retry parameters for exponential back-off
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

    this.exitHandled = false;
    ['exit', 'SIGINT', 'SIGHUP', 'SIGQUIT', 'SIGABRT', 'SIGTERM'].map((e) => {
      process.on(e, () => this.stop());
    });

    // "Semaphore" pattern to limit in-flight requests
    this.params.maxInFlight = params.maxInFlight || config.MAX_REQUESTS_IN_FLIGHT;
    this.inFlight = 0;
  }

  /**
   * Start the tracker
   */
  start() {
    if (this.isRunning) {
      return false;
    }
    this.isRunning = true;
    this.exitHandled = false;
    // Run forever and check if we can flush
    this.processStreams = setInterval(() => {
      this._flush();
    }, 500);
  }

  /**
   * Stop the tracker, returns a promise once the backlog + inFlight events are emtpy.
   * @returns {Promise}
   */
  stop() {
    return new Promise((resolve, reject) => {
      // Prevent multiple exit handlers to be called
      if (!this.exitHandled) {
        this.emit("stop");
        this.exitHandled = true;
        this.isRunning = false;
        clearInterval(this.processStreams);
        this.logger.debug(`[${TAG}] Triggered flush due to exit handler`);
        this._flush(true);
        this.stopInterval = setInterval(_ => {
          if (this.inFlight === 0) {
            clearInterval(this.stopInterval);
            this.emit("empty");
            return resolve(true);
          }
        }, 500);
      }
      return resolve(true);
    });
  }

  /**
   * Get current time in unixtime
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
    let payload = this.backlog.get(stream);
    return payload.length && // First, we should not flush an empty array
      (
        payload.length >= this.params.bulkLen || // Flush if we reached desired length (amount of events)
        sizeof(payload) >= this.params.bulkSize || // Flush if the object has reached desired byte-size
        this._shouldTriggerIntervalFlush() // Should trigger based on interval
      );
  }

  /**
   * Track data to Atom, this function returns a Promise which will be resolved only when data is tracked to backlog.
   * The function rejects the promise in 3 cases:
   * 1. Stream / Data are missing.
   * 2. Tracker has been stopped.
   * 3. Non-blocking mode and trackingTimeout has been reached.
   * @param stream - Atom stream name
   * @param data - Data to track
   * @returns Promise
   * @example Tracker Example:
   *
   * For examples: https://github.com/ironSource/atom-node/tree/master/example
   *
   */
  track(stream, data) {
    return new Promise((resolve, reject) => {
      if (stream === undefined || stream.length === 0 || data === undefined || data.length === 0) {
        return reject(new Error('Stream name and data are required parameters'));
      }
      if (!this.isRunning) {
        return reject(new Error("Tracker has been stopped. Use tracker.start() to start it"));
      }
      // Can't track for any reason
      if (!this._track(stream, data)) {
        let trackingTimeout, retryInterval;
        this.logger.debug("[TRACKER] Setting Interval");

        // Keep trying to track
        retryInterval = setInterval(_ => {
          if (this._track(stream, data)) {
            this.logger.debug("[TRACKER] Clearing Interval");
            resolve(true);
            clearInterval(retryInterval);
            clearTimeout(trackingTimeout);
          }
        }, 500);

        if (!this.params.isBlocking) {
          // Non-blocking mode: timeout after X seconds
          trackingTimeout = setTimeout(_ => {
            clearInterval(retryInterval);
            return reject(new Error("Tracking timeout"));
          }, this.params.trackingTimeout)
        }
      } else {
        resolve(true);
      }
    });
  }

  /**
   * Track data to backlog only if: We didn't reach inFlight limit & We didn't reach the backlog limit.
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
    return Promise.map(this.backlog.keys, (stream) => {
      // Force flush all streams or a certain stream
      if ((forceFlushAll || (forceFlushStream && forceFlushStream === stream)) && !this.backlog.isEmpty(stream)) {
        return this._send(stream, this.backlog.take(stream));
      } else if (!this._isMaxRequestsInFlight() && this._shouldFlush(stream)) {
        return this._send(stream, this.backlog.take(stream, config.BULK_LENGTH));
      }
      return false;
    }, {concurrency: this.params.concurrency});
  }

  /**
   * Flush data to Atom, this function returns a promise with array of server responses.
   * An error will not reject the Promise but call the 'error' event.
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
   *   console.log("[TRACKER EXAMPLE] Example flush results:", data);
   * });
   *
   * // Flush a specific stream:
   * tracker.flush("MY_STREAM");
   */
  flush(batchStream) {
    return typeof batchStream !== "undefined" ? this._flush(false, batchStream) : this._flush(true);
  }

  /**
   * Sends events to Atom using Atom Class.
   * Case of 5xx: emits a 'retry' event and retries with exponential back-off.
   * Case of error emits a 'error' event with (err, data) args.
   * @param stream - Atom Stream Name
   * @param data - Data to track
   * @returns Promise
   * @private
   */
  _send(stream, data) {
    let payload = {stream: stream, data: data};
    this.inFlight++;
    this.lastFlush = Tracker._getTimestamp();
    return promiseRetry((retry, attempt) => {
      return this.atom.putEvents(payload)
        .then((response) => {
          this.logger.debug(`[${TAG}] inFlight #: ${this.inFlight}, attempt: #${attempt}, stream: '${stream}', events: #${payload.data.length} - completed successfully`);
          if (--this.inFlight <= 0) {
            this.inFlight = 0;
          }
          return response;
        })
        .catch((err) => {
          this.logger.debug(`[${TAG}] inFlight #${this.inFlight}, attempt #${attempt} for stream: '${stream}' failed due to "${err.message}" (status ${err.status})`);
          if (err.status >= 500) {
            attempt === 1 ? this.emit('retry') : null;
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
        this.emit("error", err.msg.message, err.data);
        return Promise.resolve(false);
      });
  }
}

module.exports = Tracker;