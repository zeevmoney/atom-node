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
    params.apiVersion = this.options.apiVersion;
    params.auth = this.options.auth;

    return req.post();
  };
}

module.exports = {
  ISAtomMock: ISAtomMock
};
