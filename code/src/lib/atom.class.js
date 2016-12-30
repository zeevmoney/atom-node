'use strict';
// todo: done with class, change docs
const config = require('./../config');
const Request = require('./request.class');
const Promise = require('bluebird');
const AtomError = require('./utils').AtomError;

module.exports = class IronSourceAtom {
  /**
   *
   * Constructs an Atom service object.
   * @constructor
   * @param {Object} [options] - options for Atom class
   * @param {String} [options.endpoint] - Atom API url
   * @param {String} [options.auth] - Auth key for authentication
   * @param {String} [options.apiVersion] - Atom API version (shouldn't be changed).
   * @param {String} [options.sdkVersion] - Atom SDK Version (shouldn't be changed).
   * @param {String} [options.sdkType] - Atom SDK Type (shouldn't be changed).
   * @param {Object} [options.logger] - Alternative Logger (Bunyan or anything else)
   * @param {Boolean} [options.debug] - Enable / disable debug
   *
   */
  constructor(options) {
    options = options || {};
    this.options = Object.assign({}, {
      endpoint: config.END_POINT,
      apiVersion: config.API_VERSION,
      auth: config.AUTH,
      sdkType: config.SDK_TYPE,
      sdkVersion: config.SDK_VERSION,
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
   * @param {String} [params.auth] - Atom stream HMAC auth key
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
   * atom.putEvent(params)
   * todo: finish this
   */

  putEvent(params) {
    if (!params.stream) return Promise.reject(new AtomError('Stream name is required', 400));
    if (!params.data) return Promise.reject(new AtomError('Data is required', 400));
    params.apiVersion = this.options.apiVersion;
    params.auth = this.options.auth;
    params.sdkVersion = this.options.sdkVersion;
    params.sdkType = this.options.sdkType;
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
   * var stream = "MY.ATOM.STREAM";
   * var data = [
   * {"event_name":"JS-SDK-PUT-EVENTS-TEST","string_value":"67.217","int_value":67,"float_value":67.21,"ts":"2016-08-14T12:54:55.839Z"},
   * {"event_name":"JS-SDK-PUT-EVENTS-TEST","string_value":"2046.43","int_value":20,"float_value":2046.43,"ts":"2016-08-14T12:54:55.839Z"];
   * var atom = new IronSourceAtom();
   * atom.putEvents({ data: data, stream: stream })
   * todo: finish this
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
    paramsCopy.sdkVersion = this.options.sdkVersion;
    paramsCopy.sdkType = this.options.sdkType;
    paramsCopy.endpoint = this.options.endpoint + 'bulk';
    paramsCopy.auth = this.options.auth;
    paramsCopy.bulk = true;
    let request = new Request(paramsCopy);
    return request.post();
  }

  /**
   * Send a /GET health check to the Atom endpoint
   * @returns {Promise}
   */

  health() {
    let params = {
      endpoint: this.options.endpoint + 'health',
      apiVersion: this.options.apiVersion,
      sdkVersion: this.options.sdkVersion,
      sdkType: this.options.sdkType
    };
    let request = new Request(params);
    return request.health();
  }

};