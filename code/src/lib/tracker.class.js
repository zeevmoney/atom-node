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
    
    this.accumulated = {};
    this.atom = new ISAtom(params);

    this.timer = null;
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
    let self = this;
    if(stream == undefined || data == undefined || !data.length) {
      return logger.err('Stream or data empty');
    }

    if (!self.accumulated[stream]) self.accumulated[stream] = [];
    self.accumulated[stream].push(data);

    if (self.accumulated[stream].length >= self.params.bulkLen || sizeof(self.accumulated[stream]) >= self.params.bulkSize) {
      self.flush(stream);
    }

    else if (!self.timer) {
      self.timer = setTimeout(function() {
        self.flush();
      }, self.params.flushInterval);
    }

  }
  
  flush(batchStream, batchData, timeout) {
    let self = this;
    timeout = timeout || 1000;

    if (!!batchStream && !!batchData) {
      // for send or retry method
      send(batchStream, batchData, timeout);
    }

    else if (!!batchStream && !batchData) {
      // send with custom stream when >= len || size
      if (self.accumulated[batchStream].length >= 1) send(batchStream, self.accumulated[batchStream]);
    }

    else {
      //send all when no params
      for(let key in self.accumulated) {
        if (self.accumulated[key].length >= 1) self.flush(key, self.accumulated[key]);
        self.accumulated[key] = [];
      }
      self.timer = null;
    }
    /* istanbul ignore next */
    function send (stream, data, timeout) {
      return self.atom.putEvents({"table": stream, "data": data})
        .catch(function(err) {
          if (err.status >= 500) {
            if (timeout < 10 * 60 * 1000) {
              setTimeout(function() {
                timeout = timeout * 2;
                self.flush(stream, data, timeout);
              }, timeout);
            } else {
              //some handler for err after 10min retry fail
              return logger.err('Server not response more then 10min.');
            }
          } else {
            return logger.err(err);
          }
        });
    }
  }
};