"use strict";
const Tracker = require('../src').Tracker;
const Promise = require('bluebird');
const co = require('co');
const fs = Promise.promisifyAll(require("fs"));
let writeStream = fs.createWriteStream('./sdk_errors.log', {flags: 'a+'});

function trackerPromiseMap() {
  function errorFunc(err, data) {
    console.log(`[EXAMPLE2-ON_ERR-FUNC] Got Error: ${err}`);
    writeStream.write(`${JSON.stringify(data)} - ${err} \n`);
  }

  const params = {
    // endpoint: "https://track.atom-data.io/",
    endpoint: "http://127.0.0.1:3000/",
    auth: "I40iwPPOsG3dfWX30labriCg9HqMfL",
    debug: true,
    flushInterval: 5, // Flushing interval in seconds
    bulkLen: 250, // Max count for events for send
    bulkSize: 512 * 1024, // Max size of data for send in Kb
    trackingTimeout: 2,
    isBlocking: false,
  };

  let i = 0;
  let numOfEvents = 1000;
  let tracker = new Tracker(params);
  tracker.on("error", errorFunc);
  Promise.map(new Array(numOfEvents), function () {
    let data = {
      id: i++,
    };
    if (i % 10000 === 0) {
      console.log(`[EXAMPLE2-PROMISE-MAP] So far tracked ${i} events to Atom`)
    }
    return tracker.track("stream", data);
  }, {concurrency: 3}).then(function (data) {
    console.log(`[EXAMPLE2-PROMISE-MAP] Tracked ${data.length} to Atom`);
    writeStream.write(`Tracked ${data.length} events to atom\n`);
  }).catch(function (err) {
    console.log(`[EXAMPLE2] Track error: ${err}`);
  });
  writeStream.on('finish', () => {
    console.log('All writes are now complete.\n');
    writeStream.end('This is the end\n');
  });
}

function *trackerGenerator() {
  const params = {
    // endpoint: "https://track.atom-data.io/",
    endpoint: 'http://127.0.0.1:3000/',
    auth: "",
    debug: true,
    flushInterval: 32, // Flushing interval in seconds
    bulkLen: 250, // Max count for events for send
    bulkSize: 512 * 1024, // Max size of data for send in Kb
  };


  let tracker = new Tracker(params);
  tracker.on("stop", _ => console.log("[EXAMPLE2-GENERATOR] tracked stopped"));
  tracker.on("retry", _ => console.log("[EXAMPLE2-GENERATOR] tracker emitted 'retry' event"));
  tracker.on("empty", _ => console.log("[EXAMPLE2-GENERATOR] tracker emitted 'empty' event"));
  tracker.on("error", (err, data) => console.log("[EXAMPLE2-GENERATOR] onError function:", err));

  for (let i = 0; i < 1000; i++) {
    let data = {
      id: i
    };
    try {
      yield tracker.track("ibtest2", data);
    } catch (err) {
      console.log(err.message);
    }
  }
}


// co(trackerGenerator());
trackerPromiseMap();

