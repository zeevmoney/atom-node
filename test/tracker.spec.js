'use strict';

const co = require('co');
const Promise = require('bluebird');
const uuid = require('uuid');
const chai = require('chai');
chai.use(require('sinon-chai'));
const expect = chai.expect;
const sinon = require('sinon');
const Tracker = require('../src/lib/tracker.class');
const Atom = require('../src/lib/atom.class');
const config = require('../src/config');
const AtomError = require('../src/lib/utils').AtomError;

require('co-mocha');

describe('Tracker Class', function () {
  this.timeout(5000);

  describe('Tracker class Initialization', () => {
    it('should check correct data on tracker constructor', function () {
      let tracker = new Tracker();
      expect(tracker.params).to.have.deep.property('flushInterval', config.FLUSH_INTERVAL);
      expect(tracker.params).to.have.deep.property('bulkLen', config.BULK_LENGTH);
      expect(tracker.params).to.have.deep.property('bulkSize', config.BULK_SIZE);
      expect(tracker.params).to.have.deep.property('concurrency', config.CONCURRENCY);
      expect(tracker.params).to.have.deep.property('flushOnExit', true);
      expect(tracker.params.onError).to.be.instanceof(Object);

      let params = {
        flushInterval: 1,
        bulkLen: 100,
        bulkSize: 1,
        concurrency: 1,
        flushOnExit: false
      };

      let otherTracker = new Tracker(params);
      expect(otherTracker.params).to.have.deep.property('flushInterval', 1000);
      expect(otherTracker.params).to.have.deep.property('bulkLen', 100);
      expect(otherTracker.params).to.have.deep.property('bulkSize', 1024);
      expect(otherTracker.params).to.have.deep.property('concurrency', 1);
      expect(otherTracker.params).to.have.deep.property('flushOnExit', false);
      expect(otherTracker.params.onError).to.be.instanceof(Object);
    });

    it('Should check tracker constructor default parameters', function () {
      let params = {
        flushInterval: 0,
        bulkLen: 99999,
        bulkSize: 999999,
      };

      let otherTracker = new Tracker(params);
      expect(otherTracker.params).to.have.deep.property('flushInterval', config.FLUSH_INTERVAL);
      expect(otherTracker.params).to.have.deep.property('bulkLen', config.BULK_LENGTH);
      expect(otherTracker.params).to.have.deep.property('bulkSize', config.BULK_SIZE);
      expect(otherTracker.params).to.have.deep.property('concurrency', config.CONCURRENCY);
      expect(otherTracker.params).to.have.deep.property('flushOnExit', true);
      expect(otherTracker.params.onError).to.be.instanceof(Object);
    });
  });

  describe('Track method tests', function () {
    beforeEach(() => {
      sinon.stub(Atom.prototype, 'putEvents', function (data) {
        return Promise.resolve("200");
      });
      sinon.spy(Tracker.prototype, 'track');
      sinon.spy(Tracker.prototype, '_process');
      sinon.spy(Tracker.prototype, 'flush');
      sinon.spy(Tracker.prototype, '_send');
    });

    afterEach(() => {
      Atom.prototype.putEvents.restore();
      Tracker.prototype.flush.restore();
      Tracker.prototype.track.restore();
      Tracker.prototype._flush.restore();
      Tracker.prototype._send.restore();
    });

    it('should accumulate data backlog before flush', function*() {
      let tracker = new Tracker();
      tracker.track('stream1', 'data1');
      tracker.track('stream1', 'data2');
      expect(tracker.backlog.get('stream1')).to.be.eql(['data1', 'data2']);
    });

    it('should throw err when missing stream or data', function*() {
      let tracker = new Tracker({flushOnExit: false});
      expect(tracker.track).to.throw('Stream name and data are required parameters');
      let fn = function () {
        tracker.track(("hi"));
      };
      expect(fn).to.throw('Stream name and data are required parameters');
    });

    it('should flush when each flush interval has been reached', function*() {
      let clock = sinon.useFakeTimers();
      let tracker = new Tracker({
        flushInterval: 10,
        bulkLen: config.BULK_LENGTH_LIMIT,
        bulkSize: config.BULK_SIZE_LIMIT,
      });
      let i = 0;
      while (i < 200) {
        yield tracker.track('streamFlushInterval', {id: i, uuid: uuid.v4()});
        i++;
        clock.tick(150);
      }
      expect(tracker.track).to.have.callCount(200);
      expect(tracker._send).to.have.callCount(2);
      clock.restore();
    });

    it('should make sure flushes are executed with proper bulk length and without duplications', function*() {
      let clock = sinon.useFakeTimers();
      let tracker = new Tracker({
        flushInterval: 20000000,
        bulkLen: 20
      });
      let i = 0;
      while (i < 200) {
        yield tracker.track('stream', {id: i, uuid: uuid.v4()});
        i++;
        clock.tick(100);
      }
      expect(tracker.track).to.have.callCount(200);
      expect(tracker._send).to.have.callCount(10);
      clock.restore();
    });

    it('should flush on process exit', function*() {
      let clock = sinon.useFakeTimers(0);

      let tracker = new Tracker({
        flushInterval: 10000,
        bulkLen: config.BULK_LENGTH_LIMIT,
        bulkSize: config.BULK_SIZE_LIMIT,
        flushOnExit: true
      });

      let i = 0;
      while (i < 65) {
        yield tracker.track('stream', {id: i, uuid: uuid.v4()});
        i++;
        clock.tick(100);
      }

      let exitSpy = sinon.spy(tracker, '_exitHandler');
      process.emit('SIGHUP'); // using SIGHUP instead of SIGINT since SIGINT causes mocha to quit as well
      expect(exitSpy).to.have.callCount(1);
      expect(tracker.track).to.have.callCount(65);
      exitSpy.restore();
      clock.restore();
    });

    it('should flush everything when flush() has been called', function*() {
      let tracker = new Tracker({
        flushInterval: 1000000,
        bulkLen: config.BULK_LENGTH_LIMIT,
        bulkSize: config.BULK_SIZE_LIMIT,
        flushOnExit: false
      });

      let i = 0;
      while (i < 100) {
        i % 2 ? yield tracker.track('stream', {id: i, uuid: uuid.v4()})
          : yield tracker.track('stream2', {id: i, uuid: uuid.v4()});
        i++;
      }

      yield tracker.flush("stream");
      yield tracker.flush();
      expect(tracker._send).to.be.have.callCount(2);
      expect(tracker.backlog.isEmpty('stream')).to.be.true;
      expect(tracker.backlog.isEmpty('stream2')).to.be.true;
    });

  });

  describe('Tracker send and retry mechanism', function () {
    beforeEach(() => {
      let callCount = 1;
      sinon.stub(Atom.prototype, 'putEvents', function (data) {
        if (callCount++ < 6) {
          return Promise.reject(new AtomError("Y U NO WORK?", 500));
        }
        return Promise.resolve('success');
      });
      sinon.spy(Tracker.prototype, 'flush');
      sinon.spy(Tracker.prototype, '_process');
    });

    afterEach(() => {
      Atom.prototype.putEvents.restore();
      Tracker.prototype.flush.restore();
      Tracker.prototype._flush.restore();
    });

    it('should trigger the callback if everything fails', function*() {
      let params = {
        flushInterval: 1,
        bulkLen: 1,
        bulkSize: 1,
        retryOptions: {
          random: false,
          minTimeout: 1,
          maxTimeout: 3,
          retries: 3
        },
        onError: sinon.spy(() => {
          console.log("Called test onError func!")
        })
      };
      let tracker = new Tracker(params);
      yield tracker._send('streamCallBack', [{a: 1, b: 2, c: 3}]);
      expect(tracker.params.onError).to.be.calledOnce
    });

    it('should retry after send failure', function*() {
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

      let result = yield tracker._send('streamRetry', [{a: 1, b: 2, c: 3}]);
      expect(result).to.equal('success');
      expect(Atom.prototype.putEvents).to.have.callCount(6);
    });

  });
});