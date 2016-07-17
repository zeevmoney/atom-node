'use strict';

const Promise = require('bluebird');
const uuid = require('node-uuid');
const Tracker = Promise.promisifyAll(require('../src/lib/tracker.class'));
const ISAtom = require('../src/lib/atom.class');
const chai = require('chai');
const expect = require('chai').expect;
const sinon = require('sinon');

chai.use(require('sinon-chai'));

describe('Testing tracker class and methods', function () {
  beforeEach(function () {
    sinon.stub(ISAtom.prototype, 'putEvents', function () {
      return Promise.resolve();
    });
    sinon.spy(Tracker.prototype, 'flush');
  });

  afterEach(function () {
    ISAtom.prototype.putEvents.restore();
    Tracker.prototype.flush.restore();
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
    expect(p.params).to.be.eql(
        {
          flushInterval: 1000,
          bulkLen: 100,
          bulkSize: 1024
        }
    )
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
      expect(err).to.be.eql('Stream or data empty');
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
    expect(t.flush).to.have.been.calledOnce;
    clock.restore();
  });

  it('should make sure flushes are executed with proper batch size and without duplications', function () {
    let tracker = new Tracker({
      flushInterval: 20000,
      bulkLen: 20
    });
    let i = 0;
    while (i < 200) {
      tracker.track('stream', {id: i, uuid: uuid.v4()});
      i++;
    }

    expect(tracker.flush).to.have.callCount(10);
  });
});