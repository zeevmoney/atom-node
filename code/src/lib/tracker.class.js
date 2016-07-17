'use strict';

const config = require('./../config');

const ISAtom = require('./atom.class');
const logger = require('./logger');
const sizeof = require('object-sizeof');

const LocalStore = require('./stores/local.class');

module.exports = class Tracker {
  constructor(params) {
    params = params || {};
    this.params = params;
    this.params.flushInterval = !!params.flushInterval ? params.flushInterval * 1000 : 10000;
    this.params.bulkLen = !!params.bulkLen ? params.bulkLen : 10000;
    this.params.bulkSize = !!params.bulkSize ? params.bulkSize * 1024 :  64 * 1024; // change to Kb
    this.logger = params.logger || logger;
    this.store = params.store || new LocalStore();

    this.atom = new ISAtom(params);

    this.timer = null;

    if (this.params.flushOnExit) {
      this.exitHandled = false;
      process.on('exit', ()=>this._exitHandler());
      process.on('SIGINT', ()=>this._exitHandler());
      process.on('SIGHUP', ()=>this._exitHandler());
      process.on('SIGQUIT', ()=>this._exitHandler());
      process.on('SIGABRT', ()=>this._exitHandler());
      process.on('SIGTERM', ()=>this._exitHandler());
    }
  }

  _exitHandler() {
    // prevent multiple exit handlers to be called
    if (!this.exitHandled) {
      this.exitHandled = true;
      logger.trace('triggered flush due to process exit');
      this.flush();
    }
  }
  /**
   *
   * @param streamData
   * @returns {boolean}
   * @private
   */
  _shouldFlush(streamData) {
    return streamData.length >= this.params.bulkLen || sizeof(streamData) >= this.params.bulkSize
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
    if (this._shouldFlush(this.store.get(stream))) {
      this.flush(stream);
    }
    else if (!this.timer) {
      logger.trace(`setting up timer for ${stream} (${this.params.flushInterval}ms interval)`);
      this.timer = setTimeout(() => {
        this.flush(stream);
      }, this.params.flushInterval);
    }

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
      logger.trace(`flushing ${batchStream} with ${batchData.length} items`);
      this._send(batchStream, batchData, timeout);
    }

    else if (!!batchStream && !batchData) {
      // send with custom stream when >= len || size
      if (!this.store.isEmpty(batchStream)) {
        logger.trace(`flushing ${batchStream} with ${this.store.get(batchStream).length} items`);
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
      this.timer = null;
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