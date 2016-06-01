'use strict';

const Promise = require('bluebird');

function logger() {}

logger.err = function(message) {
  let err = new Error(message);
  
  return new Promise(function(res, reject){
    return reject (err);  
  })
};

module.exports = logger;