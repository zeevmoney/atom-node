"use strict";
const Tracker = require('../src').Tracker;
const Promise = require('bluebird');
const co = require('co');
const fs = Promise.promisifyAll(require("fs"));
let writeStream = fs.createWriteStream('./sdk_errors.log', {flags: 'a+'});

function trackerPromiseMap() {
  function errorFunc(err, data) {
    console.log(`[EXAMPLE-ERROR]: ${err}`);
    writeStream.write(`${JSON.stringify(data)} - ${err} \n`);
  }

  const params = {
    endpoint: "https://track.atom-data.io/",
    // endpoint: "http://127.0.0.1:3000/",
    auth: "I40iwPPOsG3dfWX30labriCg9HqMfL",
    debug: true,
    flushInterval: 5, // Flushing interval in seconds
    bulkLen: 250, // Max count for events for send
    bulkSize: 512 * 1024, // Max size of data for send in Kb
    onError: errorFunc
  };
  let i = 0;
  let numOfEvents = 1000;
  let tracker = new Tracker(params);
  Promise.map(new Array(numOfEvents), function () {
    if (i % 10000 == 0) {
      console.log(`wrote ${i} events to Atom`)
    }
    let number = Math.random() * (3000 - 3) + 3;
    let data = {
      id: i++,
      event_name: "NODE_SDK_TRACKER",
      strings: String(number),
      ints: Math.round(number),
      floats: number,
      ts: +new Date(),
      batch: true
    };
    return tracker.track("ssdkdev_sdkdev.public.zeev", data);
  }, {concurrency: 1}).then(function (data) {
    console.log(`Tracked ${data.length} to Atom`);
    writeStream.write(`Tracked ${data.length} events to atom\n`);
    writeStream.end('This is the end\n');
  }).catch(function (err) {
    console.log(`err: ${err}`);
    writeStream.end('This is the end\n');
  });
  writeStream.on('finish', () => {
    console.error('All writes are now complete.');
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
    onError: function (err, data) {
      console.log("on error func:", err.message);
    }
  };

  let tracker = new Tracker(params);
  for (let i = 0; i < 10000; i++) {
    let number = Math.random() * (3000 - 3) + 3;
    let data = {
      id: i,
      strings: String(number),
      ints: Math.round(number),
      floats: number,
      ts: new Date(),
      batch: true
    };
    try {
      yield tracker.track("ibtest2", data);
    } catch (err) {
      console.log(err.message);
    }
  }
}

// Tracker control with generator example

// co(trackerGenerator());
trackerPromiseMap();