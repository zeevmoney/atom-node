"use strict";

const Promise = require('bluebird');
const request = require('request');

/**
 Bypass a bug when doing promisifyAll on Request lib: on some cases after using promisifyAll,
 when there are many concurrent connections, Request lib doesn't close connections properly.
 This may leave a big number of connections open.
 * */
function fetchRequest(method, options) {
  return new Promise((resolve, reject) => {
    request[method](options, (err, res, body) => {
      if (err) {
        return reject(err);
      } else {
        return resolve([res, body]);
      }
    });
  });
}


class AtomError extends Error {
  constructor(message, status) {
    super(message);
    this.message = message;
    this.status = status;
    this.name = "AtomError";
    // this.name = this.constructor.name;
  }
}


module.exports = {
  fetchRequest: fetchRequest,
  AtomError: AtomError
};