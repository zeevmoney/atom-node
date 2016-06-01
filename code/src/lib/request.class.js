'use strict';

const config = require('./../config');

const Promise = require('bluebird');
const request = Promise.promisifyAll(require('request'), {multiArgs: true});
const crypto = require('crypto');

module.exports = class Request {
  constructor(endpoint, params) {
      if (params === 'health') {
        return this.health(endpoint);
      } else {
        this.params = params;
        return this.post(endpoint);  
      }      
  }

  post(endpoint) {
    let self = this;
    
      self.params.data = self.params.auth ? crypto.createHmac('sha256', self.params.auth).update(JSON.stringify(self.params.data)).digest('hex') : self.params.data;
    return request.postAsync({
        url: endpoint,
        method: "POST",
        headers: self.headers,
        json: true,
        body: self.params
    }).spread(function(response, body) {
      if (response.statusCode >= 400) {
        throw {message: body, status: response.statusCode};
      }
      return body;
    });
  }
  
  health(endpoint) {
    let self = this;
    /* istanbul ignore next */
    return request.getAsync({
        url: endpoint + '/health',
        headers: self.headers,
        json: true
    }).spread(function(response, body) {
      console.log(body);
      if (response.statusCode == 404 || response.statusCode >= 500) {
        throw 'Server for this url is down!';
      }
      return 'Server for this url is up!';
    })
  }
};