'use strict';

const config = require('./../config');
const logger = require('./logger');
const Request = require('./request.class');

class IronSourceAtom {
  constructor(options) {
    options = options || {};
    this.auth = !!options.auth ? options.auth : '';
    this.endpoint = !!options.endpoint && options.endpoint.toString() || config.END_POINT;
    this.apiVersion = config.API_VERSION;
    this.headers = {
      "x-ironsource-atom-sdk-type": "nodejs",
      "x-ironsource-atom-sdk-version": this.apiVersion,
      "contentType": "application/json;charset=UTF-8"
    }
  }
  /**
   *
   * Put a single event to an Atom Stream.
   * @api {get/post} https://track.atom-data.io/ putEvent Send single data to Atom server
   * @apiVersion 1.0.0
   * @apiGroup Atom
   * @apiParam {String} stream Stream name for saving data in db table
   * @apiParam {String} data Data for saving
   * @apiParam {String} method POST or GET method for do request
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
    if (!params.table)
      return logger.err('Stream is required');
    if (!params.data)
      return logger.err('Data is required');

    params.apiVersion = this.apiVersion;
    params.auth = this.auth;
    return new Request(this.endpoint, params);
  }


/**
 *
 * Put a bulk of events to Atom.
 *
 * @api {get/post} https://track.atom-data.io/bulk putEvents Send multiple events data to Atom server
 * @apiVersion 1.0.0
 * @apiGroup Atom
 * @apiParam {String} stream Stream name for saving data in db table
 * @apiParam {Array} data Multiple event data for saving
 * @apiParam {String} method POST or GET method for do request
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
    if (!params.table)
      return logger.err('Stream is required');
    if (!params.data || !(params.data instanceof Array) || !params.data.length)
      return logger.err('Data (must be not empty array) is required');
    
    params.apiVersion = this.apiVersion;
    params.auth = this.auth;
    return new Request(this.endpoint, params);
  }

  health(url) {
    url = url || this.endpoint;
    return new Request(url, 'health');
  }

}

module.exports = IronSourceAtom;
