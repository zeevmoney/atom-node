'use strict';

const ISAtom = require('../src').ISAtom;
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const mock = require("./mock/is.mock");
const config = require('../src/config');
const logger = require('../src/lib/logger');
chai.use(chaiAsPromised);
const expect = chai.expect;

describe('Atom class test', function () {

  // this.timeout(3000);

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
    let atom = new ISAtom();
    expect(atom.putEvent({stream: "test"})).to.be.rejectedWith('Data is required and should be a string');
    expect(atom.putEvent({})).to.be.rejectedWith('Stream name is required');
    expect(atom.putEvents({stream: "test"})).to.be.rejectedWith('Data must a be a non-empty Array');
    expect(atom.putEvents({data: ['some data']})).to.be.rejectedWith('Stream name is required');
  });

  it('should check health method', function() {
    let atom = new ISAtom();

    // atom.health().then(function(res) {
    //   expect(res).to.be.eql('Server for this url is up!');
    // });

    return expect(atom.health('http://localhost:3000/server-err')).to.be.rejectedWith('Connection Problem');
  })

});
