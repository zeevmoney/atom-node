'use strict';

const sizeof = require('object-sizeof');
const Promise = require('bluebird');

const config = require('./../config');
const ISAtom = require('./atom.class');
const logger = require('./logger');
const LocalStore = require('./stores/local.class');

module.exports = class Tracker {
  /**
   *
   * @param params
   * flushInterval optional(default 1 second) - interval in seconds in which the event's should be flushed
   * bulkLen optional(default 10000) - max length of each key in store
   * bulkSize optional(default 64kb) - max size in kb for each key in store
   * flushOnExit (default false) - whether all data should be flushed on application exit
   * logger optional(default console) - logger module
   * store (default localStore) - store module, implementation for the storage of keys and values
   */
  constructor(params) {
    params = params || {};
    this.params = params || {};
    this.params.flushInterval = !!params.flushInterval ? params.flushInterval * 1000 : 10000;
    this.params.bulkLen = !!params.bulkLen ? params.bulkLen : 10000;
    this.params.bulkSize = !!params.bulkSize ? params.bulkSize * 1024 : 64 * 1024; // change to Kb
    this.concurrency = params.concurrency || 10;

    this.logger = params.logger || logger;
    this.store = params.store || new LocalStore();
    this.atom = new ISAtom(params);

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
    return this.streamTimers[stream] &&
      this.params.flushInterval <= (this._getTimestamp() - this.streamTimers[stream]);
  }

  /**
   *
   * @param stream
   * @returns {boolean}
   * @private
   */
  _shouldFlush(stream) {
    let streamData = this.store.get(stream);
    return streamData.length >= this.params.bulkLen ||
      sizeof(streamData) >= this.params.bulkSize ||
      this._shouldTriggerIntervalFlush(stream)
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
  flush(batchStream, batchData, timeout) {

    timeout = timeout || 1000;
    if (!!batchStream && !!batchData) {
      // for send or retry method
      this.logger.trace(`flushing ${batchStream} with ${batchData.length} items`);
      this._send(batchStream, batchData, timeout);
    }

    else if (!!batchStream && !batchData) {
      // send with custom stream when >= len || size
      if (!this.store.isEmpty(batchStream)) {
        this.logger.trace(`flushing ${batchStream} with ${this.store.get(batchStream).length} items`);
        this._send(batchStream, this.store.take(batchStream));
      }
    }

    else {
      //send all when no params
      for (let key of this.store.keys) {
        if (!this.store.isEmpty(key)) {
          this.flush(key, this.store.take(key));
        }
      }
    }
  }

  /* istanbul ignore next */
  /**
   *
   * @param stream
   * @param data
   * @param timeout
   * @returns {Promise.<T>}
   * @private
   */
  _send(stream, data, timeout) {
    return this.atom.putEvents({"stream": stream, "data": data})
      .catch((err) => {
        if (err.status >= 500) {
          if (timeout < 10 * 60 * 1000) {
            setTimeout(()=> {
              timeout = timeout * 2;
              this.flush(stream, data, timeout);
            }, timeout);
          } else {
            //some handler for err after 10min retry fail
            return this.logger.error('Server not response more then 10min.');
          }
        } else {
          return this.logger.error(err);
        }
      });
  }
};