'use strict';

const request = require('request');
const btoa = require('btoa');
const Promise = require('bluebird');


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
    let self = this;
    if (!params.table) { let err = new Error('Stream is required'); console.log(err.message); return }
    if (!params.data) { let err = new Error('Data is required'); console.log(err.message); return }

    params.apiVersion = this.apiVersion;
    params.auth = this.auth;

    return new Promise(function(resolve, reject) {
      if (!!params.method && params.method == 'GET') {
        request({
          url: self.endpoint + '?data=' + btoa(JSON.stringify(params)),
          method: "GET",
          headers: self.headers,
          json: true
        }, function(err, res, body) {
          if (err || (res.statusCode >= 400 && res.statusCode < 500)) return reject(err ? err : body); // server response err in body
          else if (res.statusCode >= 200 && res.statusCode < 400) resolve(body);
        })
        
      } else {
        request({
          url: self.endpoint,
          method: "POST",
          headers: self.headers,
          json: true,
          body: params
        }, function(err, res, body) {
          if (err || (res.statusCode >= 400 && res.statusCode < 500)) return reject(err ? err : body); // server response err in body
          else if (res.statusCode >= 200 && res.statusCode < 400) resolve(body);
        })
      }

    }).nodeify(callback);
    
  }

  putEvents (params, callback) {
    let self = this;
    params = params || {};
    if (!params.table) {
      let err = new Error('Stream is required');
      console.log(err);
      return;
    }

    if (!params.data || !(params.data instanceof Array) || !params.data.length) {
      let err = new Error('Data (must be not empty array) is required');
      console.log(err);
      return;
    }

    params.apiVersion = this.apiVersion;
    params.auth = this.auth;

    return new Promise(function(resolve, reject) {
      if (!!params.method && params.method == 'GET') {
        request({
          url: self.endpoint + '/bulk?data=' + btoa(JSON.stringify(params)),
          method: "GET",
          headers: self.headers,
          json: true
        }, function(err, res, body) {
          if (err || (res.statusCode >= 400 && res.statusCode < 500)) return reject(err ? err : body); // server response err in body
          else if (res.statusCode >= 200 && res.statusCode < 400) resolve(body);
        })

      } else {
        request({
          url: self.endpoint + '/bulk',
          method: "POST",
          headers: self.headers,
          json: true,
          body: params
        }, function(err, res, body) {
          if (err || (res.statusCode >= 400 && res.statusCode < 500)) return reject(err ? err : body); // server response err in body
          else if (res.statusCode >= 200 && res.statusCode < 400) resolve(body);
        })
      }

    }).nodeify(callback);

  }
}


let atom = new IronSourceAtom();
// promise
atom.putEvent({"table": "ibtest", "data": "asd"}).then(function(res){
  console.log('with promise:');
  console.log(res);
}).catch(function(err){
  console.log('with promise err:');
  console.log(err);
});

//callback
atom.putEvent({"table": 'ibtes', "data": "asd", "method": "GET"}, function(err, data){
  console.log('with callback:');
  if (err) console.log('Error = ', err);
  else console.log(data);
});

module.exports = IronSourceAtom;