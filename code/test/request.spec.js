'use strict';

const Request = require('../src/lib/request.class');
const express = require('express');
const app = express();
const expect = require('chai').expect;
const mock = require("./mock/is.mock");
const btoa = require('btoa');
const assert = require('assert');
global.btoa = btoa;

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




describe('Testing Request class and methods', function() {
  before(function(){
    app.listen(3000);
  });

  let params = {
    table: "tableName",
    data: "analyticsData"
  };
  const endpoint = 'http://localhost:3000/';

  it('should send POST request', function(done) {
    let req = new Request(endpoint + 'endpoint', params);

    req.then(function(res) {
      expect(res).to.be.eql({
        status: "OK"
      });
      done();
    });
  });

  it('should send GET request', function(done) {
    params.method = 'GET';
    var req = new Request(endpoint + 'endpoint', params);

    req.then(function(res) {
      expect(res).to.be.eql({
        status: "OK"
      });
      done();
    });
  });

  it('should handle POST request error', function(done) {
    let req = new Request(endpoint + 'err', params);

    req.catch(function(err) {
      expect(err).to.be.eql({ error: 'No permission for this table' });
      done();
    });
  });

  it('should handle GET request error', function(done) {
    params.method = "GET";
    let req = new Request(endpoint + 'err', params);

    req.catch(function(err) {
      expect(err).to.be.eql({ error: 'No permission for this table' });
      done();
    });
  });

});
