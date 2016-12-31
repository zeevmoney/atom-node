'use strict';

// for npm do -> require('atom-node');

const ISAtom = require('../src').ISAtom;
const Tracker = require('../src').Tracker;
const co = require('co');
const util = require('util');
const program = require('commander');

let atom = new ISAtom({
  auth: "I40iwPPOsG3dfWX30labriCg9HqMfL"
  // endpoint: 'http://127.0.0.1:3000/'
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

  let params = {
    stream: "sdkdev_sdkdev.public.zeev",
    data: {
      strings: "hi",
      ints: 123,
      floats: 24.5,
      ts: new Date()
    }
  };

  // With co (POST):
  co(function*() {
    return yield atom.putEvent(params);
  }).then(function (res) {
    console.log(`[Example PutEvent POST] success: ${res.message} ${res.status}`);
  }, function (err) {
    console.log(`[Example PutEvent POST] failure: ${err.message} ${err.status}`);
  });

  // With co & GET method:
  params.method = 'GET';
  co(function*() {
    return yield atom.putEvent(params);
  }).then(function (res) {
    console.log(`[Example PutEvent GET] success: ${res.message} ${res.status}`);
  }, function (err) {
    console.log(`[Example PutEvent GET] failure: ${err.message} ${err.status}`);
  });

  // With promises & bad auth
  atom.options.auth = 'bad_auth';
  params.method = 'POST';
  atom.putEvent(params).then(function (res) {
    console.log(`[Example PutEvent POST] success: ${res.message} ${res.status}`);
  }).catch(function (err) {
    console.log(`[Example PutEvent POST] failure: ${err.message} ${err.status}`);
  });

  // With bad endpoint
  atom.options.endpoint = 'https://bad-end-point';
  atom.putEvent(params).then(function (res) {
    console.log(`[Example PutEvent POST] success: ${res.message} ${res.status}`);
  }).catch(function (err) {
    console.log(`[Example PutEvent POST] failure: ${err.message} ${err.status}`);
  });

}

function healthExample() {
  atom.health().then(function (res) {
    console.log(`[Example Health Check] success: ${res.message} ${res.status}`);
  }, function (err) {
    console.log(`[Example Health Check] failure: ${err.message} ${err.status}`);
  });
}

function putEventsExample() {
  let batchPayload = {
    stream: "ibtest",
    data: [],
  };

  atom.options.endpoint = "https://track.atom-data.io/";

  for (let i = 0; i < 10; i++) {
    let number = Math.random() * (3000 - 3) + 3;
    let data = {
      strings: String(number),
      ints: Math.round(number),
      floats: number,
      ts: new Date(),
      batch: true
    };
    batchPayload.data.push(data);
  }

  console.log(`[Example PutEvents] Sending ${batchPayload.data.length} events to Atom`);

  atom.putEvents(batchPayload).then(function (res) {
    console.log(`[Example PutEvents POST] success: ${res.message} ${res.status}`);
  }, function (err) {
    console.log(`[Example PutEvents POST] failure: ${err.message} ${err.status}`);
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
    tracker.track("ibtest", data);
  }
  console.log(`Sending 10 events to Atom`);

// for sending events immediately use
//  tracker.flush();

}
