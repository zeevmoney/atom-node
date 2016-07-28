'use strict';

const co = require('co');
const Promise = require('bluebird');
const uuid = require('node-uuid');
const chai = require('chai');
const sinon = require('sinon');
const expect = require('chai').expect;

const Tracker = Promise.promisifyAll(require('../src/lib/tracker.class'));
const ISAtom = require('../src/lib/atom.class');

chai.use(require('sinon-chai'));

describe('Testing tracker class and methods', function () {

  describe('tracking', function () {
    beforeEach(function () {
      sinon.stub(ISAtom.prototype, 'putEvents', function (data) {
        return Promise.resolve();
      });
      sinon.spy(Tracker.prototype, 'flush');
      sinon.spy(Tracker.prototype, 'process');
    });

    afterEach(function () {
      ISAtom.prototype.putEvents.restore();
      Tracker.prototype.flush.restore();
      Tracker.prototype.process.restore();
    });
    it('should check correct data on tracker constructor', function () {
      let t = new Tracker();

      expect(t.params).to.be.eql({
        flushInterval: 10000,
        bulkLen: 10000,
        bulkSize: 64 * 1024
      });

      let params = {
        flushInterval: 1,
        bulkLen: 100,
        bulkSize: 1
      };

      let p = new Tracker(params);
      expect(p.params).to.be.eql({
        flushInterval: 1000,
        bulkLen: 100,
        bulkSize: 1024
      })
    });

    it('should accumulate data in one arr before flush', function () {
      let t = new Tracker();

      t.track('stream', 'data1');
      t.track('stream', 'data2');
      expect(t.store.get('stream')).to.be.eql(['data1', 'data2']);
    });

    it('should throw err when stream empty', function () {
      let t = new Tracker();
      try {
        t.track()
      } catch (err) {
        expect(err).to.have.property('message', 'Stream or data empty');
      }
    });

    it('should check run flush after timeout len size', function () {
      let params = {
        flushInterval: 3,
        bulkLen: 2,
        bulkSize: 100
      };

      let clock = sinon.useFakeTimers();
      let t = new Tracker(params);

      t.track('stream', 'data');
      clock.tick(4100);
      expect(t.process).to.have.callCount(41);
      expect(t.flush).to.have.been.calledOnce;
      clock.restore();
    });

    it('should make sure flushes are executed with proper batch size and without duplications', function () {
      let clock = sinon.useFakeTimers();
      let tracker = new Tracker({
        flushInterval: 20000000,
        bulkLen: 20
      });
      let i = 0;
      while (i < 200) {
        tracker.track('stream', {id: i, uuid: uuid.v4()});
        i++;
        clock.tick(100);
      }

      expect(tracker.process).to.have.callCount(200);
      expect(tracker.flush).to.have.callCount(10);
      clock.restore();
    });
    it('should flush on process exit', function () {
      let clock = sinon.useFakeTimers();
      let tracker = new Tracker({
        flushInterval: 20000,
        bulkLen: 50,
        flushOnExit: true
      });
      let i = 0;
      while (i < 65) {
        tracker.track('stream', {id: i, uuid: uuid.v4()});
        i++;
        clock.tick(100);
      }

      process.emit('SIGHUP'); // using SIGHUP instead of SIGNIT since SIGINT causes mocha to quit as well
      expect(tracker.flush).to.have.been.calledThrice;
      expect(tracker.process).to.have.callCount(65);
      clock.restore();
    });
  });

  describe('send mechanism', function () {
    beforeEach(function () {
      let callCount = 1;
      sinon.stub(ISAtom.prototype, 'putEvents', function (data) {
        if (callCount++ < 6) {
          return Promise.reject({status: 501, message: "some weird failure involving the server and some fun-time"});
        }
        return Promise.resolve('success');
      });
      sinon.spy(Tracker.prototype, 'flush');
      sinon.spy(Tracker.prototype, 'process');
    });

    afterEach(function () {
      ISAtom.prototype.putEvents.restore();
      Tracker.prototype.flush.restore();
      Tracker.prototype.process.restore();
    });

    it('should retry after send failure', co.wrap(function *(done) {
      let tracker = new Tracker({
        flushInterval: 20000,
        bulkLen: 1,
        flushOnExit: false,
        retryOptions: {
          random: false,
          minTimeout: 10,
          maxTimeout: 50,
          maxRetries: 10
        }
      });

      let result = yield tracker._send('stream', [{a: 1, b: 2, c: 3}]);
      expect(result).to.equal('success');
      expect(ISAtom.prototype.putEvents).to.have.callCount(6);
    }));
  });
});