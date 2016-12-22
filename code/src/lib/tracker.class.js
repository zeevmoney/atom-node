'use strict';

const sizeof = require('object-sizeof');
const Promise = require('bluebird');
const promiseRetry = require('promise-retry');
const config = require('./../config');
const ISAtom = require('./atom.class');
const logger = require('./logger');
const LocalStore = require('./stores/local.class');

module.exports = class Tracker {
  /**
   *
   * @param params
   * flushInterval optional(default 10 seconds) - interval in seconds in which the events should be flushed
   * bulkLen optional(default 10000) - max length of each key in store (the data array of each stream)
   * bulkSize optional(default 64kb) - max size in kb for each key in store (the data array of each stream)
   * flushOnExit (default false) - whether all data should be flushed on application exit
   * logger optional(default console) - logger module
   * store (default localStore) - store module, implementation for the storage of keys and values
   * retryOptions (object) - node-retry(https://github.com/tim-kos/node-retry) options
   * auth optional - your atom api key
   * - retries (default 10) - The maximum amount of times to retry the operation.
   * - factor (default 2) - The exponential factor to use.
   * - minTimeout (default 1000) - The number of milliseconds before starting the first retry.
   * - maxTimeout (default Infinity)- The maximum number of milliseconds between two retries.
   * - randomize (default false) - Randomizes the timeouts by multiplying with a factor between 1 to 2
   */
  constructor(params) {
    params = params || {};
    this.params = params || {};

    // flush logic parameters
    this.params.flushInterval = !!params.flushInterval ? params.flushInterval * 1000 : 10000;
    this.params.bulkLen = !!params.bulkLen ? params.bulkLen : 10000;
    this.params.bulkSize = !!params.bulkSize ? params.bulkSize * 1024 : 64 * 1024; // change to Kb

    // processing parameters
    this.concurrency = params.concurrency || 10;

    // retry parameters for exponential backoff
    this.retryOptions = Object.assign({}, {
      retries: 10,
      randomize: true,
      factor: 2,
      minTimeout: 250,
      maxTimeout: 25 * 60 * 60
    }, params.retryOptions);

    this.logger = params.logger || logger;
    this.store = params.store || new LocalStore();
    this.atom = new ISAtom(params);

    // timers dictionary for each stream
    this.streamTimers = {};

    if (this.params.flushOnExit) {
      this.exitHandled = false;
      ['exit', 'SIGINT', 'SIGHUP', 'SIGQUIT', 'SIGABRT', 'SIGTERM']
        .map((e) => {
          process.on(e, ()=>this._exitHandler())
        });
    }

    /**
     * will process streams and determine whether they should be flushed each 100 milliseconds
     * @type {any}
     */
    this.processInerval = setInterval(()=> {
      this.process();
    }, 100 /* ms */);

  }

  /**
   *
   * @private
   */
  _exitHandler() {
    // prevent multiple exit handlers to be called
    if (!this.exitHandled) {
      this.exitHandled = true;
      clearInterval(this.processInerval);
      this.logger.trace('triggered flush due to process exit');
      this.flush();
    }
  }

  /**
   *
   * @return {number}
   * @private
   */
  _getTimestamp() {
    return +new Date();
  }

  /**
   *
   * @param stream
   * @return {*|boolean}
   * @private
   */
  _shouldTriggerIntervalFlush(stream) {
    return (this.streamTimers[stream] !== undefined) &&
      this.params.flushInterval <= (this._getTimestamp() - this.streamTimers[stream]);
  }

  /**
   * determines whether the stream should be flushed based on 3 conditions
   * 1. payload length reached
   * 2. payload size reached
   * 3. time since last flush
   * @param stream
   * @returns {boolean} - whether the stream should be flushed
   * @private
   */
  _shouldFlush(stream) {
    let payload = this.store.get(stream);
    return payload.length && // first, we should not flush an empty array
      (
        payload.length >= this.params.bulkLen || // flush if we reached desired length (amount of events)
        sizeof(payload) >= this.params.bulkSize || // flush if the object has reached desired byte-size
        this._shouldTriggerIntervalFlush(stream) // should trigger based on interval
      );
  }

  /**
   *
   * Start track events
   *
   * @api {post} endpoint/bulk track Accumulate and send events to server
   * @apiVersion 1.1.0
   * @apiGroup Atom
   * @apiParam {String} stream Stream name for saving data in db table
   * @apiParam {All} data Event data for saving
   *
   * @apiSuccess {Null} err Server response error
   * @apiSuccess {Object} data Server response data
   * @apiSuccess {String} status Server response status
   *
   * @apiError {Object} err Server response error
   * @apiError {Null} data Server response data
   * @apiError {String} status Server response status
   *
   * @apiErrorExample Error-Response:
   *  HTTP 401 Permission Denied
   *  {
   *    "err": {"Target Stream": "Permission denied",
   *    "data": null,
   *    "status": 401
   *  }
   *
   * @apiSuccessExample Response:
   * HTTP 200 OK
   * {
   *    "err": null,
   *    "data": "success"
   *    "status": 200
   * }
   * @apiParamExample {json} Request-Example:
   * {
   *    "stream": "streamName",
   *    "data": "Some data"
   * }
   *
   */
  track(stream, data) {
    if (stream == undefined || data == undefined) {
      throw new Error('Stream or data empty');
    }
    this.store.add(stream, data);
    if (!this.streamTimers[stream]) {
      this.streamTimers[stream] = this._getTimestamp();
      this.logger.trace(`[track] no timer set-up for stream ${stream}, setting.`);
    }
  }

  process() {
    return Promise.map(this.store.keys, (stream)=> {
      if (this._shouldFlush(stream)) {
        this.streamTimers[stream] = this._getTimestamp();
        return this.flush(stream);
      }
    }, {concurrency: this.concurrency});
  }

  /**
   *
   * @param batchStream
   * @param batchData
   * @param timeout
   */
  flush(batchStream, batchData) {

    if (!!batchStream && !!batchData) {
      // for send or retry method
      this.logger.trace(`[flush] flushing ${batchStream} with ${batchData.length} items`);
      this._send(batchStream, batchData);

    } else if (!!batchStream && !batchData) {
      // send with custom stream when >= len || size
      if (!this.store.isEmpty(batchStream)) {
        this.logger.trace(`[flush] flushing ${batchStream} with ${this.store.get(batchStream).length} items`);
        this._send(batchStream, this.store.take(batchStream));
      }

    } else {
      //send all when no params were given
      for (let key of this.store.keys) {
        if (!this.store.isEmpty(key)) {
          this.flush(key, this.store.take(key));
        }
      }
    }
  }

  /**
   * @param stream
   * @param data
   * @returns {Promise.<T>}
   * @private
   */
  _send(stream, data) {
    let payload = {stream: stream, data: data};
    return promiseRetry((retry, number)=> {
      return this.atom.putEvents(payload)
        .then((data)=> {
          this.logger.debug(`retry #${number} for stream '${stream}' completed successfully`);
          return data;
        })
        .catch((err) => {
          this.logger.warn(`retry #${number} for stream '${stream}' failed due to "${err.message}" (status ${err.status})`);
          if (err.status >= 500) {
            retry(err)
          } else {
            throw err;
          }
        });
    }, this.retryOptions).then(Promise.resolve, Promise.reject);
  }
};