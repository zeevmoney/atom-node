'use strict';

// for npm do -> require('atom-node');

const ISAtom = require('../src').ISAtom;
const Tracker = require('../src').Tracker;
const co = require('co');
const program = require('commander');

let atom = new ISAtom({
  auth: "I40iwPPOsG3dfWX30labriCg9HqMfL"
});

program
  .version('1.0.0')
  .option('-p, --putevent', 'Run the putEvent examples')
  .option('-P, --putevents', 'Run the putEvents examples')
  .option('-H, --health', 'run the health check example', {isDefault: true})
  .option('-t, --tracker', 'run the tracker example')
  .option('-a, --all', 'Run all of the examples')
  .parse(process.argv);

if (program.putevent) putEventExamples();
if (program.putevents) putEventsExample();
if (program.health) healthExample();
if (program.tracker) trackerExample();
if (program.all) runAllExamples();
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

function runAllExamples() {
  putEventExamples();
  putEventsExample();
  healthExample();
  trackerExample();
}


function putEventExamples() {

  let data = {
    stream: "test",
    data: JSON.stringify({
      strings: "hi",
      ints: 123,
      floats: 24.5,
      ts: new Date()
    })
  };

  // With co:
  co(function* () {
    return yield atom.putEvent(data);
  }).then(function (res) {
    console.log('PutEvent POST success:', res);
  }, function (err) {
    console.log('PutEvent POST failure:', err);
  });


  // With co & GET method:
  data.method = 'GET';
  co(function* () {
    return yield atom.putEvent(data);
  }).then(function (res) {
    console.log('PutEvent GET success:', res);
  }, function (err) {
    console.log('PutEvent GET failure:', err);
  });


  // With promises & bad auth
  atom.auth = 'bad_auth';
  atom.putEvent(data).then(function (res) {
    console.log('PutEvent POST success:', res);
  }).catch(function (err) {
    console.log('PutEvent POST failure:', err);
  });

  // With bad endpoint
  atom.endpoint = 'http://127.0.0.1';
  atom.putEvent(data).then(function (res) {
    console.log('PutEvent POST success:', res);
  }).catch(function (err) {
    console.log('PutEvent POST failure:', err);
  });

}

function healthExample() {
  atom.health().then(function (res) {
    console.log('Health check success:', res);
  }, function (err) {
    console.log('Health check failure:', err);
  });
}

function putEventsExample() {
  let bulk = {
    stream: "test",
    data: []
  };

  for (let i = 0; i < 10; i++) {
    let number = Math.random() * (3000 - 3) + 3;
    let data = {
      strings: String(number),
      ints: Math.round(number),
      floats: number,
      ts: new Date(),
      batch: true
    };
    bulk.data.push(data);
  }

  console.log(`Sending ${bulk.data.length} events to Atom`);

  atom.putEvents(bulk).then(function (res) {
    console.log('PutEvents success:', res);
  }).catch(function (err) {
    console.log('PutEvents error:', err);
  });
}

function trackerExample() {
  const params = {
    endpoint: "https://track.atom-data.io/",
    auth: "",
    flushInterval: 10, // Flushing interval in seconds
    bulkLen: 9, // Max count for events for send
    bulkSize: 64 // Max size of data for send in Kb
  };

  let tracker = new Tracker(params);

  for (let i = 0; i < 10; i++) {
    let number = Math.random() * (3000 - 3) + 3;
    let data = {
      strings: String(number),
      ints: Math.round(number),
      floats: number,
      ts: new Date(),
      batch: true
    };
    tracker.track("test", data);
  }
  console.log(`Sending 10 events to Atom`);

// for sending events immediately use
//  tracker.flush();

}