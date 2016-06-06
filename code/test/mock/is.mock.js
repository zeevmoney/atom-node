'use strict';
const Promise = require('bluebird');
const config = require('../../src/config');

function ISAtomMock(opt) {
  opt = opt || {};
  this.options = {
    endpoint: "/some-url",
    apiVersion: config.API_VERSION,
    auth: "auth-key"
  };

  this.putEvents = this.putEvent = function(params) {
    var req = new RequestMockHelper(this.options.endpoint, params);

    params.apiVersion = this.options.apiVersion;
    params.auth = this.options.auth;

    return req.post();
  };
}

function RequestMockHelper(url, params) {

  this.post = function() {
    return params;
  }
}

module.exports = {
  ISAtomMock: ISAtomMock
};
