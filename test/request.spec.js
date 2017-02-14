'use strict';

const config = require('../src/config');
const crypto = require('crypto');
const Request = require('../src/lib/request.class');
const chai = require('chai');
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const expect = chai.expect;
const nock = require('nock');
require('co-mocha');

const AtomError = require('../src/lib/utils').AtomError;

describe('Request Class', () => {

  describe('Request class Initialization', () => {
    let request;
    let testFunction;

    before(() => {
      request = new Request({
        endpoint: config.END_POINT,
        data: {"a": 123},
        stream: "hi"
      });
    });

    it('should init a Request object with correct parameters', function*() {
      expect(request.params).to.be.eql({
        endpoint: config.END_POINT,
        data: JSON.stringify({"a": 123}),
        stream: "hi"
      });
    });

    before(() => {
      let obj = {};
      obj.a = {b: obj};
      testFunction = function () {
        new Request({endpoint: '/endpoint', data: obj});
      };
    });

    it('should return an error on invalid data', function*() {
      expect(testFunction).to.throw(`data is invalid - can't be stringified`);
      expect(testFunction).to.throw(AtomError);
    });

  });

  describe('handling POST requests', () => {
    before(() => {

      nock("https://track.atom-data.io")
        .post('/ok')
        .reply(200, (uri, requestBody) => {
          let digest = crypto.createHmac('sha256', "YULIE").update(requestBody.data).digest('hex');
          return {
            Status: "OK",
            validAuth: digest,
            auth: requestBody.auth
          }
        })

        .post('/bad-auth')
        .reply(401, (uri, requestBody) => {
          return `Auth Error: "${requestBody.stream}"`
        })

        .post('/no-connection')
        .replyWithError({code: 'ECONNREFUSED'})

        .post('/unknown-error')
        .replyWithError("ALL YOUR BASE ARE BELONG TO US")

        .post('/check-headers')
        .reply(200, function () {
          return {
            sdkVersion: this.req.headers['x-ironsource-atom-sdk-version'],
            sdkType: this.req.headers['x-ironsource-atom-sdk-type']
          }
        });
    });
    after(() => {
      nock.cleanAll()
    });

    it('should send POST request successfully', function*() {
      let request = new Request({
        endpoint: config.END_POINT + "ok",
        data: {"MOCK": "DATA"},
        auth: "YULIE",
        stream: "OK"
      });
      let response = yield request.post();
      let responseParsed = JSON.parse(response.message);
      expect(response.status).to.eql(200);
      expect(responseParsed.Status).to.eql('OK');
      expect(responseParsed.auth).to.eql(responseParsed.validAuth);
    });

    it('should handle POST request auth error', function*() {
      let request = new Request({
        endpoint: config.END_POINT + "bad-auth",
        data: {"a": 123},
        auth: "BAD_AUTH",
        stream: "STREAM_WITH_BAD_AUTH"
      });
      try {
        yield request.post();
      } catch (error) {
        expect(error.status).to.eql(401);
        expect(error.name).to.eql('AtomError');
        expect(error.message).to.eql(`Auth Error: "STREAM_WITH_BAD_AUTH"`)
      }
    });

    it('should handle POST request connection error', function*() {
      let request = new Request({
        endpoint: config.END_POINT + "no-connection",
        data: {"a": 123},
        auth: "BAD_AUTH",
        stream: "CONNECTION_ERROR"
      });
      try {
        yield request.post();
      } catch (error) {
        expect(error.message).to.eql('Connection Problem');
        expect(error.status).to.eql(500);
        expect(error.name).to.eql('AtomError');
      }
    });

    it('should handle POST request unknown error', function*() {
      let request = new Request({
        endpoint: config.END_POINT + "unknown-error",
        data: {"a": 123},
        auth: "BAD_AUTH",
        stream: "UNKNOWN_ERROR"
      });
      try {
        yield request.post();
      } catch (error) {
        expect(error.message).to.eql(new Error('ALL YOUR BASE ARE BELONG TO US'));
        expect(error.status).to.eql(400);
        expect(error.name).to.eql('AtomError');
      }
    });

    it('should validate POST request headers', function*() {
      let request = new Request({
        endpoint: config.END_POINT + "check-headers",
        data: {"a": 123},
        auth: "GOOD_AUTH",
        stream: "OK"
      });
      let response = yield request.post();
      let headers = JSON.parse(response.message);
      expect(headers.sdkVersion).to.eql(config.HEADERS['x-ironsource-atom-sdk-version']);
      expect(headers.sdkType).to.eql(config.HEADERS['x-ironsource-atom-sdk-type']);
    });

  });

  describe('handling GET requests', () => {
    before(() => {

      nock("https://track.atom-data.io")
        .filteringPath(/\/ok\?data=.+/g, '/?data=GET_TEST')
        .get('/?data=GET_TEST')
        .reply(200, function (uri) {
          let data = uri.split("=")[1];
          return {Status: "OK", data: data};
        });


      nock("https://track.atom-data.io")
        .filteringPath(/\/check-headers\?data=.+/g, '/?check-headers=GET_TEST')
        .get('/?check-headers=GET_TEST')
        .reply(200, function () {
          return {
            sdkVersion: this.req.headers['x-ironsource-atom-sdk-version'],
            sdkType: this.req.headers['x-ironsource-atom-sdk-type']
          }
        });

      // GET with bad auth
      nock("https://track.atom-data.io")
        .filteringPath(/\/bad-auth\?data=.+/g, '/?bad-auth=GET_TEST')
        .get('/?bad-auth=GET_TEST')
        .reply(401, (uri) => {
          uri = decodeURIComponent(uri);
          let data = uri.split("=")[1];
          let decodedBase64 = new Buffer(data, 'base64').toString();
          decodedBase64 = JSON.parse(decodedBase64);
          return `Auth Error: "${decodedBase64.stream}"`
        });

      // GET with no connection
      nock("https://track.atom-data.io")
        .filteringPath(/\/no-connection\?data=.+/g, '/?no-connection=GET_TEST')
        .get('/?no-connection=GET_TEST')
        .replyWithError({code: 'ECONNREFUSED'});

      nock("https://track.atom-data.io")
        .filteringPath(/\/unknown-error\?data=.+/g, '/?unknown-error=GET_TEST')
        .get('/?unknown-error=GET_TEST')
        .replyWithError("ALL YOUR BASE ARE BELONG TO US")

    });
    after(() => {
      nock.cleanAll()
    });


    it('should send GET request successfully', function*() {
      let request = new Request({
        endpoint: config.END_POINT + "ok",
        data: {"a": 123},
        stream: "OK"
      });
      let response = yield request.get();
      let responseMsg = JSON.parse(response.message);
      expect(response.status).to.eql(200);
      expect(responseMsg.Status).to.eql("OK");
      expect(responseMsg.data).to.eql("eyJkYXRhIjoie1wiYVwiOjEyM30iLCJzdHJlYW0iOiJPSyIsImF1dGgiOiIifQ%3D%3D");
    });

    it('should handle GET request auth error', function*() {
      let request = new Request({
        endpoint: config.END_POINT + "bad-auth",
        data: {"a": 123},
        auth: "BAD_AUTH",
        stream: "STREAM_WITH_BAD_AUTH"
      });
      try {
        yield request.get();
      } catch (error) {
        expect(error.status).to.eql(401);
        expect(error.name).to.eql('AtomError');
        expect(error.message).to.eql(`Auth Error: "STREAM_WITH_BAD_AUTH"`)
      }
    });

    it('should handle GET request bad connection error', function*() {
      let request = new Request({
        endpoint: config.END_POINT + "no-connection",
        data: {"a": 123},
        auth: "BAD_AUTH",
        stream: "CONNECTION_ERROR"
      });
      try {
        yield request.get();
      } catch (error) {
        expect(error.message).to.eql('Connection Problem');
        expect(error.status).to.eql(500);
        expect(error.name).to.eql('AtomError');
      }
    });

    it('should handle GET request unknown error', function*() {
      let request = new Request({
        endpoint: config.END_POINT + "unknown-error",
        data: {"a": 123},
        auth: "BAD_AUTH",
        stream: "UNKNOWN_ERROR"
      });
      try {
        yield request.get();
      } catch (error) {
        expect(error.message).to.eql(new Error('ALL YOUR BASE ARE BELONG TO US'));
        expect(error.status).to.eql(400);
        expect(error.name).to.eql('AtomError');
      }
    });

    it('should validate GET request headers', function*() {
      let request = new Request({
        endpoint: config.END_POINT + "check-headers",
        data: {"a": 123},
        auth: "GOOD_AUTH",
        stream: "OK"
      });
      let response = yield request.get();
      let headers = JSON.parse(response.message);
      expect(headers.sdkVersion).to.eql(config.HEADERS['x-ironsource-atom-sdk-version']);
      expect(headers.sdkType).to.eql(config.HEADERS['x-ironsource-atom-sdk-type']);
    });
  });

  describe('handing GET to /health endpoint', () => {
    before(() => {
      nock("https://track.atom-data.io")
        .get('/health')
        .reply(200, "up");

      nock("https://bad-track.atom-data.io")
        .get('/health')
        .reply(500, "down");

    });
    after(() => {
      nock.cleanAll()
    });


    it('should handle a valid GET health request', function*() {
      let request = new Request({
        endpoint: config.END_POINT,
        data: {"a": 123},
        auth: "GOOD_AUTH",
        stream: "OK"
      });
      let response = yield request.health();
      expect(response.message).to.eql('Atom API is up');
      expect(response.status).to.eql(200);
    });

    it('should handle an error in GET health request', function*() {
      let request = new Request({
        endpoint: "https://bad-track.atom-data.io/",
      });
      try {
        yield request.health();
      } catch (error) {
        expect(error.message).to.eql('Atom API is down');
        expect(error.status).to.eql(500);
        expect(error.name).to.eql('AtomError');
      }
    });

  });

});

