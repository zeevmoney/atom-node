'use strict';

const Promise = require('bluebird');
const Tracker = Promise.promisifyAll(require('../src/lib/tracker.class'));
const ISAtom = require('../src/lib/atom.class');
const chai = require('chai');
const expect = require('chai').expect;
const spies = require('chai-spies');
chai.use(spies);


describe('Testing tracker class and methods', function() {
  it('should check correct data on tracker constructor', function() {
    let t = new Tracker();

    expect(t.params).to.be.eql({
      flushInterval: 10000,
      bulkLen: 10000,
      bulkSize: 1024*1024
    });
  });

  it('should accumulate data in one arr before flush', function() {
    let t = new Tracker();
    
    t.track('stream', 'data1');
    t.track('stream', 'data2');
    expect(t.accumulated['stream']).to.be.eql(['data1', 'data2']);
  });

  it('should throw err when stream empty', function() {
    let t = new Tracker();
    
    t.track().catch(function(err){
      expect(err).to.be.eql(new Error('Stream or data empty'));
    });
  });
  
});