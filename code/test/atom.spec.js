'use strict';

const ISAtom = require('../src').ISAtom;
const expect = require('chai').expect;
const mock = require("./mock/is.mock");
const config = require('../src/config');
const logger = require('../src/lib/logger');

describe('Atom class test', function () {

  it('should generate new IronSourceAtom object with default values', function () {
    var atom = new ISAtom();

    expect(atom).to.eql({
      endpoint: "https://track.atom-data.io/",
      apiVersion: config.API_VERSION,
      auth: "",
      headers: {
        "x-ironsource-atom-sdk-type": "nodejs",
        "x-ironsource-atom-sdk-version": config.API_VERSION
      }
    })
  });

  it('should generate new IronSourceAtom object with custom values', function () {
    var opt = {
      endpoint: "/some-url",
      auth: "aM<dy2gchHsad07*hdACY"
    };
    var atom = new ISAtom(opt);

    expect(atom.endpoint).to.eql(opt.endpoint);
    expect(atom.auth).to.eql(opt.auth);

  });

  it('should generate right data for POST request', function () {
    var atom = new mock.ISAtomMock();
    var param = {
      table: 'table',
      data: 'data'
    };

    expect(atom.putEvent(param)).to.be.eql({
      apiVersion: config.API_VERSION,
      auth: "auth-key",
      table: "table",
      data: "data"
    });
  });

  it('should generate right data for POST request', function () {
    let atom = new ISAtom();
    let param = {
      stream: 'test',
      data: 'data'
    };
    let param2 = {
      stream: 'test',
      data: ['data']
    };

    atom.putEvent(param).catch(function () {
      expect(param.apiVersion).to.be.not.undefined;
      expect(param.auth).to.be.not.undefined;
    });

    atom.putEvents(param2).catch(function () {
      expect(param.apiVersion).to.be.not.undefined;
      expect(param.auth).to.be.not.undefined;
    });
  });

  it('should throw error for putEvent/putEvents if no required params', function () {
    try {
      var atom = new ISAtom();
      atom.putEvent({stream: "test"})
    } catch (err) {
      expect(err).to.eql('Data is required and should be a string');
    }
    try {
      atom.putEvent({})
    } catch (err) {
      expect(err).to.eql('Stream name is required!');
    }
    try {
      atom.putEvents({stream: "test"})
    } catch (err) {
      expect(err).to.eql('Data must a be a non-empty Array');
    }
    try {
      atom.putEvents({data: ['some data']})
    } catch (err) {
      expect(err).to.eql('Stream name is required');
    }

  });
});
