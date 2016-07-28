'use strict';

const config = require('./../config');
const logger = require('./logger');
const Request = require('./request.class');
const Promise = require('bluebird');

class IronSourceAtom {
  constructor(options) {
    options = options || {};
    this.auth = !!options.auth ? options.auth : '';
    this.endpoint = !!options.endpoint && options.endpoint.toString() || config.END_POINT;
    this.apiVersion = config.API_VERSION;
    this.headers = {
      "x-ironsource-atom-sdk-type": "nodejs",
      "x-ironsource-atom-sdk-version": this.apiVersion
    }
  }

  /**
   *
   * Put a single event to an Atom Stream.
   * @api {post} https://track.atom-data.io/ putEvent Send single data to Atom server
   * @apiVersion 1.1.0
   * @apiGroup Atom
   * @apiParam {String} stream Stream name for saving data in db table
   * @apiParam {String} data Data for saving
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
   *
   * @apiParamExample {json} Request-Example:
   * {
   *    "stream": "streamName",
   *    "data":  "{\"name\": \"iron\", \"last_name\": \"Source\"}"
   * }
   *
   */

  putEvent(params) {
    params = params || {};
    if (!params.stream)
      return logger.error('Stream name is required!');
    if (!params.data || (typeof params.data !== 'string' && !(params.data instanceof String)))
      return logger.error('Data is required and should be a string');
    params.apiVersion = this.apiVersion;
    params.auth = !!params.auth ? params.auth : this.auth;
    params.bulk = false;
    return new Request(this.endpoint, params);
  }


  /**
   *
   * Put a bulk of events to Atom.
   *
   * @api {post} https://track.atom-data.io/bulk putEvents Send multiple events data to Atom server
   * @apiVersion 1.1.0
   * @apiGroup Atom
   * @apiParam {String} stream Stream name for saving data in db table
   * @apiParam {Array} data Multiple event data for saving
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
 *    "data":  ["{\"name\": \"iron\", \"last_name\": \"Source\"}",
 *            "{\"name\": \"iron2\", \"last_name\": \"Source2\"}"]
 *
 * }
   *
   */

  putEvents(params) {
    params = params || {};
    if (!params.stream) {
      return Promise.reject(new Error('Stream is required'));
    }

    if (!params.data || !(params.data.constructor == Array) || !params.data.length) {
      return Promise.reject(new Error('Data must a be a non-empty Array'));
    }
    try {
      params.data = JSON.stringify(params.data);
    } catch (err) {
      return Promise.reject(new Error("Invalid data", err));
    }
    params.apiVersion = this.apiVersion;
    params.auth = !!params.auth ? params.auth : this.auth;
    params.bulk = true;
    return new Request(this.endpoint, params);
  }

  /**
   *
   * Check server health.
   *
   * @api {get} https://track.atom-data.io/health health Send check request to Atom server
   * @apiVersion 1.1.0
   * @apiGroup Atom
   * @apiParam {String} url Endpoint server url for check
   *
   * @apiSuccess {String} message Server for this url is up!
   *
   * @apiError {String} message 'Server for this url is down!'
   *
   */
  health(url) {
    url = url || this.endpoint;
    return new Request(url, 'health');
  }

}

module.exports = IronSourceAtom;
