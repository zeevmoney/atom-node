'use strict';

const config = require('./../config');

const ISAtom = require('./atom.class');
const logger = require('./logger');
const sizeof = require('object-sizeof');

module.exports = class Tracker {
  constructor(params) {
    params = params || {};
    this.params = params;
    this.params.flushInterval = !!params.flushInterval ? params.flushInterval * 1000 : 10000;
    this.params.bulkLen = !!params.bulkLen ? params.bulkLen : 10000;
    this.params.bulkSize = !!params.bulkSize ? params.bulkSize * 1024 :  64 * 1024; // change to Kb

    this.logger = params.logger || logger;

    this.accumulated = {};
    this.atom = new ISAtom(params);

    this.timer = null;
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
      logger.error('Stream or data empty');
    }

    if (!this.accumulated[stream]) {
      this.accumulated[stream] = [];
    }
    this.accumulated[stream].push(data);

    if (this._shouldFlush(this.accumulated[stream])) {
      this.flush(stream);
    }

    else if (!this.timer) {
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
      this._send(batchStream, batchData, timeout);
    }

    else if (!!batchStream && !batchData) {
      let data = this.accumulated[batchStream];
      // send with custom stream when >= len || size
      if (data.length >= 1) {
        this._send(batchStream, data.splice(0));
      }
    }

    else {
      //send all when no params
      for (let key in this.accumulated) {
        let data = this.accumulated[key];
        if (data.length >= 1) {
          this.flush(key, data.splice(0));
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