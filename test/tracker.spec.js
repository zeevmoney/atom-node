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
      expect(tracker.params).to.have.deep.property('isBlocking', config.IS_BLOCKING);
      expect(tracker.params).to.have.deep.property('trackingTimeout', config.TRACKING_TIMEOUT);

      let params = {
        flushInterval: 1,
        bulkLen: 100,
        bulkSize: 1,
        concurrency: 1,
        isBlocking: false,
        trackingTimeout: 3
      };

      let otherTracker = new Tracker(params);
      expect(otherTracker.params).to.have.deep.property('flushInterval', 1000);
      expect(otherTracker.params).to.have.deep.property('bulkLen', 100);
      expect(otherTracker.params).to.have.deep.property('bulkSize', 1024);
      expect(otherTracker.params).to.have.deep.property('concurrency', 1);
      expect(otherTracker.params).to.have.deep.property('isBlocking', !config.IS_BLOCKING);
      expect(otherTracker.params).to.have.deep.property('trackingTimeout', 3000);
    });

    it('Should check enforcement of tracker constructor parameters limit', function () {
      let params = {
        flushInterval: 0,
        bulkLen: 99999,
        bulkSize: 999999,
        trackingTimeout: 0
      };

      let otherTracker = new Tracker(params);
      expect(otherTracker.params).to.have.deep.property('flushInterval', config.FLUSH_INTERVAL);
      expect(otherTracker.params).to.have.deep.property('bulkLen', config.BULK_LENGTH);
      expect(otherTracker.params).to.have.deep.property('bulkSize', config.BULK_SIZE);
      expect(otherTracker.params).to.have.deep.property('concurrency', config.CONCURRENCY);
      expect(otherTracker.params).to.have.deep.property('trackingTimeout', config.TRACKING_TIMEOUT);
    });
  });

  describe('Track and Flush method tests', () => {

    describe('track() method', () => {

      before(() => {
        sinon.stub(Atom.prototype, 'putEvents').callsFake(function (data) {
          return Promise.reject(new AtomError("Y U NO WORK?", 500));
        });
      });

      after(() => {
        Atom.prototype.putEvents.restore();
      });

      it('should accumulate tracker data backlog', function*() {
        let tracker = new Tracker();
        tracker.track('stream1', 'data1');
        tracker.track('stream1', 'data2');
        expect(tracker.backlog.get('stream1')).to.be.eql(['data1', 'data2']);
      });

      it('should throw err when missing stream or data on track', function*() {
        let tracker = new Tracker();
        let error;
        try {
          yield tracker.track();
        } catch (err) {
          error = err;
        }
        expect(error.message).to.eql('Stream name and data are required parameters');

        try {
          yield tracker.track("hi");
        } catch (err) {
          error = err;
        }
        expect(error.message).to.eql('Stream name and data are required parameters');
      });

      it('should timeout and throw error after tracking timeout has passed', function*() {
        let params = {
          flushInterval: 10000,
          maxInFlight: 1,
          bulkLen: 1,
          bulkSize: 1,
          backlogSize: 1,
          isBlocking: false,
          trackingTimeout: 1
        };
        let tracker = new Tracker(params);
        let error;
        try {
          yield tracker.track('some_stream', 'data');
          yield tracker.track('some_stream', 'data');
        } catch (err) {
          error = err;
        }
        expect(error.message).to.eql('Tracking timeout');
      });

    });

    describe('flush() method', () => {
      beforeEach(() => {
        sinon.stub(Atom.prototype, 'putEvents').callsFake(function (data) {
          return Promise.resolve("200");
        });
        sinon.spy(Tracker.prototype, 'track');
        sinon.spy(Tracker.prototype, 'flush');
        sinon.spy(Tracker.prototype, '_flush');
        sinon.spy(Tracker.prototype, '_send');
      });

      afterEach(() => {
        Atom.prototype.putEvents.restore();
        Tracker.prototype.flush.restore();
        Tracker.prototype.track.restore();
        Tracker.prototype._flush.restore();
        Tracker.prototype._send.restore();
      });

      it('should flush on process exit', function*() {
        let clock = sinon.useFakeTimers(0);

        let tracker = new Tracker({
          flushInterval: 10000,
          bulkLen: config.BULK_LENGTH_LIMIT,
          bulkSize: config.BULK_SIZE_LIMIT,
        });
        let stopSpy = sinon.spy();
        let emptySpy = sinon.spy();
        tracker.on('stop', stopSpy);
        tracker.on('empty', emptySpy);

        let i = 0;
        while (i < 65) {
          yield tracker.track('stream', {id: i, uuid: uuid.v4()});
          i++;
          clock.tick(100);
        }

        let exitSpy = sinon.spy(tracker, 'stop');

        process.emit('SIGHUP'); // using SIGHUP instead of SIGINT since SIGINT causes mocha to quit as well
        clock.tick(1000);
        expect(exitSpy).to.have.callCount(1);
        expect(stopSpy).to.have.callCount(1);
        expect(emptySpy).to.have.callCount(1);
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


      it('should flush when each flush interval has been reached', function*() {
        let clock = sinon.useFakeTimers();
        let tracker = new Tracker({
          flushInterval: 10,
          maxInFlight: 50,
          bulkLen: config.BULK_LENGTH_LIMIT,
          bulkSize: config.BULK_SIZE_LIMIT,
        });
        let i = 0;
        while (i < 201) {
          yield tracker.track('streamFlushInterval', {id: i, uuid: uuid.v4()});
          i++;
          clock.tick(150);
        }
        expect(tracker.track).to.have.callCount(201);
        expect(tracker._send).to.have.callCount(2);
        clock.restore();
      });

      it('should make sure flushes are executed with proper bulk length and without duplications', function*() {
        let clock = sinon.useFakeTimers();
        let tracker = new Tracker({
          flushInterval: 20000000,
          bulkLen: 20,
          maxInFlight: 50
        });
        let i = 0;
        while (i < 200) {
          yield tracker.track('stream', {id: i, uuid: uuid.v4()});
          i++;
          clock.tick(500);
        }
        expect(tracker.track).to.have.callCount(200);
        expect(tracker._send).to.have.callCount(10);
        clock.restore();
      });

    });

  });

  describe('Tracker send and retry mechanism', () => {

    beforeEach(() => {
      let callCount = 1;
      sinon.stub(Atom.prototype, 'putEvents').callsFake(function (data) {
        if (callCount++ < 6) {
          return Promise.reject(new AtomError("Y U NO WORK?", 500));
        }
        return Promise.resolve('success');
      });
      sinon.spy(Tracker.prototype, 'flush');
      sinon.spy(Tracker.prototype, '_flush');
    });

    afterEach(() => {
      Atom.prototype.putEvents.restore();
      Tracker.prototype.flush.restore();
      Tracker.prototype._flush.restore();
    });

    it('should emit `error` event if everything fails', function*() {
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
      };
      let tracker = new Tracker(params);
      let spy = sinon.spy();
      tracker.on('error', spy);
      try {
        yield tracker._send('streamCallBack', [{a: 1, b: 2, c: 3}]);
      } catch (e) {
      }
      expect(spy).to.have.been.calledOnce;
      expect(spy).to.be.calledWith("Y U NO WORK?", {data: [{a: 1, b: 2, c: 3}], stream: "streamCallBack"})
    });

    it('should retry after send failure', function*() {
      let tracker = new Tracker({
        flushInterval: 20000,
        bulkLen: 1,
        retryOptions: {
          random: false,
          minTimeout: 10,
          maxTimeout: 50,
          maxRetries: 10
        }
      });
      let spy = sinon.spy();
      tracker.on('retry', spy);
      let result = yield tracker._send('streamRetry', [{a: 1, b: 2, c: 3}]);
      expect(result).to.equal('success');
      expect(spy).to.be.calledOnce;
      expect(Atom.prototype.putEvents).to.have.callCount(6);
    });

  });
});