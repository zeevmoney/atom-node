'use strict';

const config = require('./../config');

const Promise = require('bluebird');
const request = require('request');
const btoa = require('btoa');
const crypto = require('crypto');

module.exports = class Request {
  constructor(endpoint, params) {
      this.params = params;
      this.timer = 1000;
      if (!!this.params.method && this.params.method == "GET") {
        return this.get(endpoint);
      }
    else return this.post(endpoint);
  }

  post(endpoint) {
    let self = this;
    return new Promise(function(resolve, reject) {
      self.params.data = self.params.auth ? crypto.createHmac('sha256', self.params.auth).update(JSON.stringify(self.params.data)).digest('hex') : self.params.data;
      request({
        url: endpoint,
        method: "POST",
        headers: self.headers,
        json: true,
        body: self.params
      }, function(err, res, body){
        if (err || (res.statusCode >= 400 && res.statusCode < 500)) return reject(err ? err : body);
        else if (res.statusCode >= 200 && res.statusCode < 400) resolve(body);
        else {
          if (self.timer >= 2 * 60 * 1000) {
            return reject(err ? err : body);
          } else {
            setTimeout(function(){
              self.timer = self.timer * 2;
              self.post(endpoint);
            }, self.timer);
          }
        }
      })
    })
  }

  get(endpoint) {
    let self = this;
    self.params.data = self.params.auth ? crypto.createHmac('sha256', self.params.auth).update(JSON.stringify(self.params.data)).digest('hex') : self.params.data;
    return new Promise(function(resolve, reject) {
      request({
        url: endpoint + '?data=' + btoa(JSON.stringify(self.params)),
        method: "GET",
        headers: self.headers,
        json: true
      }, function(err, res, body){
        if (err || (res.statusCode >= 400 && res.statusCode < 500)) return reject(err ? err : body);
        else if (res.statusCode >= 200 && res.statusCode < 400) resolve(body);
        else {
          if (self.timer >= 2 * 60 * 1000) {
            return reject(err ? err : body);
          } else {
            setTimeout(function(){
              self.timer = self.timer * 2;
              self.get(endpoint);
            }, self.timer);
          }
        }
      })
    })
  }
};