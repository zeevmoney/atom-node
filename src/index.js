'use strict';

const request = require('request');
const btoa = require('btoa');

const API_VERSION = 1.0;
const END_POINT = "https://track.atom-data.io/";


class IronSourceAtom {
  constructor(options) {
    options = options || {};
    this.auth = !!options.auth ? options.auth : '';
    this.endpoint = !!options.endpoint && options.endpoint.toString() || END_POINT;
    this.apiVersion = API_VERSION;
    this.headers = {
      "x-ironsource-atom-sdk-type": "nodejs",
      "x-ironsource-atom-sdk-version": this.apiVersion,
      "contentType": "application/json;charset=UTF-8"
    }
  }

  putEvent(params, callback) {
    params = params || {};
    if (!params.table) { let err = new Error('Stream is required'); console.log(err.message); return }
    if (!params.data) { let err = new Error('Data is required'); console.log(err.message); return }

    params.apiVersion = this.apiVersion;
    params.auth = this.auth;

    new Request(this.endpoint, params, callback);
  }

  putEvents (params, callback) {
    params = params || {};
    if (!params.table) {
      throw new Error('Stream is required');
    }
  
    if (!params.data || !(params.data instanceof Array) || !params.data.length) {
      throw new Error('Data (must be not empty array) is required');
    }
  
    params.apiVersion = this.apiVersion;
    params.auth = this.auth;
    
    new Request(this.endpoint + '/bulk', params, callback);

  }
}

class Request {
  constructor(endpoint, params, callback){
    if (params.method == 'GET') {
      this.get(endpoint, params, callback);
    } else {
      this.post(endpoint, params, callback);
    }
  }

  post(endpoint, params, callback) {
    request({
      url: endpoint,
      method: "POST",
      headers: this.headers,
      json: true,
      body: params
    }, function(err, res, body) {
      console.log(err);
      if(err) return callback(err, body, res.statusCode);
      else return callback(null, body, res.statusCode);
    });
  }

  get(endpoint, params, callback) {
    request({
      url: endpoint + '?data=' + btoa(JSON.stringify(params)),
      method: "GET",
      headers: this.headers,
      json: true
    }, function(err, res, body) {
      console.log(err);
      if (err) return callback(err, body, res.statusCode);
      else return callback(null, body, res.statusCode);
    })
  }

}

let atom = new IronSourceAtom();

atom.putEvents({"table": 'ibest', "data": ['asd']}, function(err, data, status){
  console.log(err, status);
  console.log(data);
});

module.exports = IronSourceAtom;