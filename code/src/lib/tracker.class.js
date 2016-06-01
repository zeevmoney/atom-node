'use strict';

const config = require('./../config');

const Request = require('./request.class');
const Promise = require('bluebird');
const ISAtom = require('./atom.class');
const logger = require('./logger');
const sizeof = require('object-sizeof');

module.exports = class Tracker {
  constructor(params) {
    params = params || {};
    this.params = params;
    this.params.flushInterval = !!params.flushInterval ? params.flushInterval : 10000;
    this.params.bulkLen = !!params.bulkLen ? params.bulkLen : 10000;
    this.params.bulkSize = !!params.bulkSize ? params.bulkSize:  1024 * 1024;
    
    this.accumulated = [];
    this.atom = new ISAtom(params);

    this.timer = null;
  }

  track(stream, data) {
    let self = this;
    data.length && !!stream ? self.accumulated.push(data) : logger.err('Stream or data empty');
    self.stream = stream;
    if (self.accumulated.length >= self.params.bulkLen || sizeof(self.accumulated) >= self.params.bulkSize) {
      self.flush();
    } else {
      self.timer = setTimeout(function() {
        self.flush();
      }, self.params.flushInterval);
    }
  }

  flush(batchStream, batchData, timeout) {
    let self = this;
    let stream, data;
    timeout = timeout || 1000;
    
    if (!!batchStream && !!batchData) {
      stream = batchStream;
      data = batchData;
    }
    else {
      stream = self.stream; 
      data = self.accumulated;
      self.accumulated = [];
    }
    
    return self.atom.putEvents({"table": stream, "data": data})
      .then(function(res){
        // change to some result or no message
        console.log(res);
      })
      .catch(function(err) {
        // console.log(err);
        if (err.status >= 500) {
          if (timeout < 10 * 60 * 1000) {
            setTimeout(function() {
              timeout = timeout * 2;
              self.flush(stream, data, timeout);
            }, timeout);
          } else {
            //maybe logger err
            return console.err('Server not response more then 10min.');
          }          
        }
      });
    
  }
};