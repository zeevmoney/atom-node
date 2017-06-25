'use strict';

const config = require('./../config');
const Promise = require('bluebird');
const crypto = require('crypto');
const util = require('util');
const TAG = 'REQUEST';
const fetchRequest = require('./utils').fetchRequest;
const AtomError = require('./utils').AtomError;

/**
 * The purpose of this class is to wrap all requests sent to the Atom API
 * in order to grantee a unified response syntax (for higher level SDK functions to use)
 * and to format requests according to the api specification.
 * */

class Request {

  /**
   * Handles all requests to ironSource atom
   * @constructor
   * @param {Object} params - Request class parameters.
   * @param {String} params.endpoint - The Atom endpoint we send to.
   * @param {(String|Array|Object)} params.data - Payload that will be delivered to Atom.
   * @param {String} params.stream - Atom stream name
   * @param {String} [params.auth] - Atom Stream HMAC auth key
   * @param {String} [params.method] - HTTP send method
   */

  constructor(params) {
    this.params = params || {};
    this.logger = this.params.logger || config.LOGGER;

    // If we delivered some params and it's not a string we try to stringify it.
    if ((typeof this.params.data !== 'string' && !(this.params.data instanceof String))) {
      try {
        this.params.data = JSON.stringify(this.params.data);
      } catch (e) {
        throw new AtomError("data is invalid - can't be stringified", 400);
      }
    }

    this.headers = config.HEADERS;
  };

  /**
   * Send a GET request to Atom API
   * @returns {Promise}
   */
  get() {
    this._createAuth();
    let base64Data = new Buffer(JSON.stringify({
      data: this.params.data,
      stream: this.params.stream,
      auth: this.params.auth
    })).toString('base64');

    let options = {
      url: this.params.endpoint,
      headers: this.headers,
      json: true,
      qs: {
        data: base64Data
      }
    };

    return fetchRequest('get', options)
      .spread((response, body) => {
        if (response.statusCode === 200) {
          return Promise.resolve({message: JSON.stringify(body), status: response.statusCode});
        } else if (response.statusCode >= 400 && response.statusCode < 600) {
          throw new AtomError(body, response.statusCode);
        }
      }).catch((error) => Request._errorHandler(error));
  }

  /**
   * Send a POST request to Atom API
   * @returns {Promise}
   */
  post() {
    this._createAuth();

    let payload = {
      stream: this.params.stream,
      auth: this.params.auth,
      data: this.params.data,
      bulk: this.params.bulk
    };

    let options = {
      url: this.params.endpoint,
      headers: this.headers,
      json: true,
      body: payload
    };

    return fetchRequest('post', options)
      .spread((response, body) => {
        if (response.statusCode === 200) {
          return Promise.resolve({message: JSON.stringify(body), status: response.statusCode});
        } else if (response.statusCode >= 400 && response.statusCode < 600) {
          throw new AtomError(body, response.statusCode);
        }
      }).catch((error) => Request._errorHandler(error));
  }

  /**
   * Perform a health check on Atom API
   * @returns {Promise}
   */
  health() {
    let options = {
      url: this.params.endpoint + 'health',
      headers: this.headers,
      json: true
    };
    return fetchRequest('get', options)
      .spread((response, body) => {
        if (response.statusCode === 200) {
          return Promise.resolve({message: "Atom API is up", status: response.statusCode});
        }
        throw new AtomError("Atom API is down", response.statusCode);
      }).catch((error) => Request._errorHandler(error));
  }

  /**
   * Handles the errors of all HTTP functions
   * @param error
   * @returns {Promise.<*>}
   * @private
   */
  static _errorHandler(error) {
    if (error.name === 'AtomError') {
      return Promise.reject(error);
    }
    if (error.code === 'ECONNREFUSED') {
      return Promise.reject(new AtomError(`Connection Problem`, 500));
    }
    return Promise.reject(new AtomError(error, 400));
  }

  /**
   * Create auth for stream
   * @private
   */
  _createAuth() {
    this.params.auth = !!this.params.auth
      ? crypto.createHmac('sha256', this.params.auth).update(this.params.data).digest('hex')
      : '';
  }

}

module.exports = Request;