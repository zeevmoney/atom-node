'use strict';

const Request = require('../src/lib/request.class');
const express = require('express');
const sinon = require('sinon')
const chai = require('chai');
const chaiAsPromised = require("chai-as-promised");
const app = express();
const assert = require('assert');
chai.use(chaiAsPromised);
const expect = chai.expect;

app.post(/endpoint(\?data=.*)?/, function(req, res){
  res.status(200);
  res.send({"status": "OK"})
});
app.get(/endpoint(\?data=.*)?/, function(req, res){
  res.status(200);
  res.send({"status": "OK"})
});

app.post(/server-err(\?data=.*)?/, function(req, res){
  res.status(500);
  res.send({"error": "Server error"})
});
app.get(/server-err(\?data=.*)?/, function(req, res){
  res.status(500);
  res.send({"error": "Server error"})
});

app.post(/err(\?data=.*)?/, function(req, res){
  res.status(401);
  res.send({"error": "No permission for this table"})
});
app.get(/err(\?data=.*)?/, function(req, res){
  res.status(401);
  res.send({"error": "No permission for this table"})
});

app.get('/health', function(req, res){
  res.status(200);
  res.send({"status": "OK"})
});

describe('Testing Request class and methods', function() {
  before(function () {
    app.listen(3000);
  });

  let params = {
    table: "tableName",
    data: "analyticsData"
  };
  let req;
  const endpoint = 'http://localhost:3000/';
  describe('handling POST requests', () => {
    it('should send POST request', function (done) {
      req = new Request(endpoint + 'endpoint', params);
      req.then(function (res) {
        expect(res).to.be.eql({
          message: {status: "OK"},
          status: 200
        });
        done();
      });
    });
    it('should handle POST request error', function (done) {
      req = new Request(endpoint + 'err', params);
      req.catch(function (err) {
        expect(err).to.be.eql({
          message: {error: 'No permission for this table'},
          status: 401
        });
        done();
      });
    });
  })
  describe('handling GET requests', () => {
    before(() => {
      params.method = "GET"
    });
    describe('When the endpoint doesnt return an ferror', () => {
      before(() => {
        req = new Request(endpoint + 'endpoint', params);
      });
      it('should send GET requests', () => {
        return req.then( res => {
          expect(res).to.be.eql({
            message: {status: "OK"},
            status: 200
          });
        })
      })
    });
    describe('When the endpoint returns an error code', () => {
      before(() => {
        req = new Request(endpoint + 'err', params);
      });
      it('should handle GET request error', () => {
        return req.catch(err => {
          expect(err).to.be.eql({
            message:{error: "No permission for this table"},
            status: 401
          })
        })
      })
    })
  });
  describe('Testing health endpoint', () => {
    describe('if endpoint is healthy', () => {
      before(() => {
        params = 'health';
        sinon.spy(Request.prototype, "_fetch");
        req = new Request(endpoint, params);
      });
      it('should return a resolved promise', () => {
        expect(req).to.be.fulfilled
      })
      it('request should be sent', () => {
        expect(Request.prototype._fetch).to.be.calledOnce
      })
      after(() => {
        params = {
          table: "tableName",
          data: "analyticsData"
        };
      })
    })
  })
});
