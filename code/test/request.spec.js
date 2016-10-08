'use strict';

const Request = require('../src/lib/request.class');
const express = require('express');
const chai = require('chai');
const chaiAsPromised = require("chai-as-promised");
const app = express();
const mock = require("./mock/is.mock");
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
        message: {status: "OK"},
        status: 200
      });
      done();
    });
  });

  it('should handle POST request error', function(done) {
    let req = new Request(endpoint + 'err', params);

    req.catch(function(err) {
      expect(err).to.be.eql({
        message: {error:'No permission for this table'},
        status: 401
      });
      done();
    });
  });

});
