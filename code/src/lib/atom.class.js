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

  putEvent(params) {
    params = params || {};
    // let self = this;
    if (!params.table)
      return logger.err('Stream is required');
    if (!params.data)
      return logger.err('Data is required');

    params.apiVersion = this.apiVersion;
    params.auth = this.auth;
    return new Request(this.endpoint, params);
  }

  putEvents(params) {
    // let self = this;
    params = params || {};
    if (!params.table)
      logger.err('Stream is required');

    if (!params.data || !(params.data instanceof Array) || !params.data.length)
      return logger.err('Data (must be not empty array) is required');
    
    params.apiVersion = this.apiVersion;
    params.auth = this.auth;
    return new Request(this.endpoint, params);
  }

}

module.exports = IronSourceAtom;
