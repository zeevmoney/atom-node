'use strict';
// todo: done with class, change docs
const config = require('./../config');
const Request = require('./request.class');
const Promise = require('bluebird');
const AtomError = require('./utils').AtomError;

class IronSourceAtom {
  /**
   * Constructs an Atom service object.
   * @constructor
   * @param {Object} [options] - options for Atom class
   * @param {String} [options.endpoint] - Atom API url
   * @param {String} [options.auth] - Atom stream HMAC auth key
   * @param {String} [options.apiVersion] - Atom API version (shouldn't be changed).
   * @param {Object} [options.logger=console] - Alternative Logger (Bunyan or anything else)
   * @param {Boolean} [options.debug=false] - Enable / disable debug
   *
   */
  constructor(options) {
    options = options || {};
    this.options = Object.assign({}, {
      endpoint: config.END_POINT,
      apiVersion: config.API_VERSION,
      auth: config.AUTH,
      debug: config.DEBUG,
      logger: config.LOGGER
    }, options);
  }

  /**
   * putEvent - Put a single event to an Atom stream.
   * @param {Object} params - Parameters that the function can take
   * @param {String} params.stream - Atom stream name
   * @param {(String|Object)} params.data - Data to be sent (stringified data or object)
   * @param {String} [params.method=POST] - HTTP method (POST or GET)
   * @param {String} [params.endpoint] - Atom API endpoint
   * @returns {Promise}
   *
   * @example Request-Example:
   *
   * var stream = "MY.ATOM.STREAM";
   * var data = {
   *     event_name: "JS-SDK-PUT-EVENT-TEST",
   *     string_value: String(number),
   *     int_value: Math.round(number),
   *     float_value: number,
   *     ts: new Date()
   * };
   *
   * var atom = new IronSourceAtom();
   * var params = {
   *    data: data,
   *    stream: stream,
   *    method: 'GET' // default is POST
   * };
   *
   *
   *  // With co (POST):
   * co(function*() {
   *   try {
   *     let res = yield atom.putEvent(params);
   *     console.log(`[Example PutEvent POST] success: ${res.message} ${res.status}`);
   *   } catch (err) {
   *     console.log(`[Example PutEvent POST] failure: ${err.message} ${err.status}`);
   *   }
   * });
   *
   *
   * // With promises
   * params.method = 'POST';
   * atom.putEvent(params).then(function (res) {
   *    console.log(`[Example PutEvent POST] success: ${res.message} ${res.status}`);
   * }).catch(function (err) {
   *    console.log(`[Example PutEvent POST] failure: ${err.message} ${err.status}`);
   * });
   */

  putEvent(params) {
    if (!params.stream) return Promise.reject(new AtomError('Stream name is required', 400));
    if (!params.data) return Promise.reject(new AtomError('Data is required', 400));
    params.apiVersion = this.options.apiVersion;
    params.auth = this.options.auth;
    params.endpoint = this.options.endpoint;
    params.bulk = false;
    let request = new Request(params);
    return (!!params.method && params.method.toUpperCase() === "GET") ? request.get() : request.post();
  }

  /**
   * putEvents - Put a bulk of events to Atom.
   *
   * @param {Object} params - parameters that the function can take
   * @param {String} params.stream - atom stream name
   * @param {Array} params.data - Multiple events in an an array
   * @returns {Promise}
   *
   * @example Request-Example:
   *
   * let batchPayload = {
   *   stream: "ibtest",
   *   data: [],
   * };
   * for (let i = 0; i < 10; i++) {
   *   let number = Math.random() * (3000 - 3) + 3;
   *   let data = {
   *      strings: String(number),
   *      ints: Math.round(number),
   *      floats: number,
   *      ts: new Date(),
   *      batch: true
   *   };
   *   batchPayload.data.push(data);
   * }
   * atom.putEvents(batchPayload).then(function (res) {
   *   console.log(`[Example PutEvents POST] success: ${res.message} ${res.status}`);
   * }, function (err) {
   *   console.log(`[Example PutEvents POST] failure: ${err.message} ${err.status}`);
   * });
   */

  putEvents(params) {
    params = params || {};
    // We copy because we get a String on retry (passed by ref)
    let paramsCopy = Object.assign({}, params);

    if (!paramsCopy.stream) {
      return Promise.reject(new AtomError('Stream name is required', 400));
    }

    if (!paramsCopy.data || !(Array.isArray(paramsCopy.data)) || !paramsCopy.data.length) {
      return Promise.reject(new AtomError('Data must a be a non-empty Array', 400));
    }

    if (paramsCopy.method) {
      // Even though it will only send POST we want to notify the client that he is not sending correctly.
      if (paramsCopy.method.toUpperCase() == 'GET') {
        return Promise.reject(new AtomError('GET is not a valid method for putEvents', 400));
      }
    }

    paramsCopy.apiVersion = this.options.apiVersion;
    paramsCopy.endpoint = this.options.endpoint + 'bulk';
    paramsCopy.auth = this.options.auth;
    paramsCopy.bulk = true;
    let request = new Request(paramsCopy);
    return request.post();
  }

  /**
   * Send a /GET health check to the Atom endpoint
   * @returns {Promise}
   * @example Health Check Example:
   * atom.health().then(function (res) {
   *   console.log(`[Example Health Check] success: ${res.message} ${res.status}`);
   * }, function (err) {
   *   console.log(`[Example Health Check] failure: ${err.message} ${err.status}`);
   * });
   */

  health() {
    let params = {
      endpoint: this.options.endpoint,
      apiVersion: this.options.apiVersion,
    };
    let request = new Request(params);
    return request.health();
  }
}

module.exports = IronSourceAtom;