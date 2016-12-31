'use strict';

const config = require('../src/config');
const Request = require('../src/lib/request.class');
const Atom = require('../src').ISAtom;
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const expect = chai.expect;
const sinon = require('sinon');
const Promise = require('bluebird');
require('co-mocha');

describe('Atom Class', () => {
  describe('Atom class Initialization', () => {
    it('should generate new Atom object with default values', function*() {
      let atom = new Atom();
      expect(atom.options).to.eql({
        endpoint: config.END_POINT,
        apiVersion: config.API_VERSION,
        auth: config.AUTH,
        sdkType: config.SDK_TYPE,
        sdkVersion: config.SDK_VERSION,
        debug: config.DEBUG,
        logger: config.LOGGER
      })
    });
    it('should generate new Atom object with custom values', function*() {
      let options = {
        endpoint: "/some-url",
        auth: "aM<dy2gchHsad07*hdACY"
      };
      let atom = new Atom(options);
      expect(atom.options.endpoint).to.eql(options.endpoint);
      expect(atom.options.auth).to.eql(options.auth);

    });
  });

  describe('Atom class methods parameter generation', () => {
    before(() => {
      sinon.stub(Request.prototype, "get", function () {
        return Promise.resolve(this.params);
      });

      sinon.stub(Request.prototype, "post", function () {
        return Promise.resolve(this.params);
      });

      sinon.stub(Request.prototype, "health", function () {
        return Promise.resolve(this.params)
      });
    });

    it('should generate right data for putEvent POST request', function*() {
      let atom = new Atom({auth: 'auth-key'});
      let putEventParams = {
        stream: 'ATOM_STREAM',
        data: 'data'
      };

      let putEventData = yield atom.putEvent(putEventParams);
      expect(putEventData).to.be.eql({
        apiVersion: config.API_VERSION,
        auth: "auth-key",
        stream: "ATOM_STREAM",
        data: "data",
        bulk: false,
        endpoint: config.END_POINT,
        sdkType: config.SDK_TYPE,
        sdkVersion: config.SDK_VERSION
      });
    });
    it('should generate right data for putEvent GET request', function*() {
      let atom = new Atom({auth: 'auth-key'});
      let putEventParams = {
        stream: 'ATOM_STREAM',
        data: 'data',
        method: 'GET'
      };

      let putEventData = yield atom.putEvent(putEventParams);
      expect(putEventData).to.be.eql({
        apiVersion: config.API_VERSION,
        auth: "auth-key",
        stream: "ATOM_STREAM",
        data: "data",
        bulk: false,
        method: 'GET',
        endpoint: config.END_POINT,
        sdkType: config.SDK_TYPE,
        sdkVersion: config.SDK_VERSION
      });
    });
    it('should generate right data for putEvents POST request', function*() {
      let atom = new Atom({auth: 'auth-key'});
      let putEventParams = {
        stream: 'ATOM_STREAM',
        data: ['data']
      };

      let putEventsData = yield atom.putEvents(putEventParams);
      expect(putEventsData).to.be.eql({
        apiVersion: config.API_VERSION,
        auth: "auth-key",
        stream: "ATOM_STREAM",
        data: "[\"data\"]",
        bulk: true,
        endpoint: config.END_POINT + 'bulk',
        sdkType: config.SDK_TYPE,
        sdkVersion: config.SDK_VERSION
      });
    })
    it('should throw error for putEvent missing params', function*() {
      let atom = new Atom();
      try {
        yield atom.putEvent({stream: "test"})
      } catch (error) {
        expect(error.message).to.eql('Data is required');
        expect(error.status).to.eql(400);
        expect(error.name).to.eql('AtomError');
      }

      try {
        yield atom.putEvent({})
      } catch (error) {
        expect(error.message).to.eql('Stream name is required');
        expect(error.status).to.eql(400);
        expect(error.name).to.eql('AtomError');
      }
    });
    it('should throw error for putEvents missing params', function*() {
      let atom = new Atom();

      try {
        yield atom.putEvents({stream: "test", data: "data"})
      } catch (error) {
        expect(error.message).to.eql('Data must a be a non-empty Array');
        expect(error.status).to.eql(400);
        expect(error.name).to.eql('AtomError');
      }

      try {
        yield atom.putEvents({})
      } catch (error) {
        expect(error.message).to.eql('Stream name is required');
        expect(error.status).to.eql(400);
        expect(error.name).to.eql('AtomError');
      }

      try {
        yield atom.putEvents({stream: "test", data: ["data"], method: 'GET'})
      } catch (error) {
        expect(error.message).to.eql('GET is not a valid method for putEvents');
        expect(error.status).to.eql(400);
        expect(error.name).to.eql('AtomError');
      }


    });
    it('should generate right data for GET /health method', function*() {
      let atom = new Atom();
      let healthData = yield atom.health();
      expect(healthData).to.be.eql({
        apiVersion: config.API_VERSION,
        data: undefined,
        endpoint: config.END_POINT + 'health',
        sdkType: config.SDK_TYPE,
        sdkVersion: config.SDK_VERSION
      });
    });

    after(() => {
      Request.prototype.post.restore();
      Request.prototype.get.restore();
      Request.prototype.health.restore();
    });
  });
});
