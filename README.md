# ironSource.atom SDK for Node-JS

[![License][license-image]][license-url]
[![Docs][docs-image]][docs-url]
[![Coverage Status][coveralls-image]][coveralls-url]
[![Build status][travis-image]][travis-url]
[![npm version][npm-image]][npm-url]  

atom-node is the official [ironSource.atom](http://www.ironsrc.com/data-flow-management) SDK for Node.JS Javascript runtime

- [Signup](https://atom.ironsrc.com/#/signup)
- [Documentation][docs-url]
- [Installation](#installation)
- [Usage](#usage)
- [Change Log](#change-log)
- [Example](#example)

## Installation

### Installation using npm
```sh
$ npm install atom-node --save
```

## Usage

### High Level SDK - "Tracker"
The tracker is used for sending events to Atom based on several conditions
- Every 10 seconds (default)
- Number of accumulated events has reached 250 (default)
- Size of accumulated events has reached 128KB (default)  
Case of server side failure (500) the tracker uses an exponential back off mechanism with jitter.  
[For a list of all available tracker config options, check the docs](https://ironsource.github.io/atom-node/Tracker.html)
```js
const AtomTracker = require('atom-node').Tracker;
co(function*() {
  const params = {
    endpoint: "https://track.atom-data.io/", // Optional, Don't change this (unless you have your own DNS CNAME)
    auth: "YOUR PRE-SHARED HAMC AUTH KEY", // Can be found in Atom Console
    flushInterval: 10, // Optional, Flushing interval in seconds
    bulkLen: 1000, // Optional, Max count for events to send
    bulkSize: 128, // Optional, Max size of data in Kb
  };

  let tracker = new AtomTracker(params);
  tracker.on('error', (err, data) => {
    // Handle Flush errors in here (write to file for example)
    console.log(`[TRACKER EXAMPLE] Got Error: ${err} for #${data.data.length} events`);
  });
  for (let i = 0; i < 10; i++) {
    let data = {
      id: i
    };
    try {
      yield tracker.track("SOME STREAM", data)
    } catch (err) {
      console.log(`[TRACKER EXAMPLE] track() method Error: ${err}`);
    }
  }
  // For sending events immediately use
  tracker.flush();
});
```
### Tracker Flow Control
The methods: track() and flush() are decoupled and independent of each other.  

**track() method behaviour:**    
Tracks data to backlog, returns a Promise which will be resolved only when data is tracked to backlog.  
The function rejects the Promise in 3 cases:
1. Stream and/or Data are missing.
2. Tracker has been stopped.
3. In Non-blocking mode and trackingTimeout has been reached.

**track() by default is blocking, but you can set it as non-blocking.**  
If block is true (the default), block if necessary until a free slot is available.   
If block is false and timeout is a positive number: blocks at most timeout seconds (10 by default)  
and emit and error event if no free slot was available within that time.

### Tracker Error Handling
All track() errors need to be handled by a regular try-catch block.  
All flush() errors are handled by 'error event'.  
[See here for all usage examples](example/example2.js)  
**Error event is mandatory and you must listen to it.**
```js
tracker.on("error", (err, data) => console.log("[EXAMPLE2-GENERATOR] onError function:", err, data));
```
### Tracker Events:
Except for 'error', the tracker emits this optional events:
- retry - on first retry to server (500)
The following are called only when there is a graceful shutdown:  
- stop  - when stop() is called or when tracker gets a killing signal
- empty - when the backlog is empty and there are no more in flight msgs
```js
tracker.on("stop", _ => console.log("[EXAMPLE2-GENERATOR] tracker stopped"));
tracker.on("retry", _ => console.log("[EXAMPLE2-GENERATOR] tracker emitted 'retry' event"));
tracker.on("empty", _ => console.log("[EXAMPLE2-GENERATOR] tracker emitted 'empty' event"));
```

### Tracker Backlog
The tracker is using a simple in memory storage for its [backlog](https://ironsource.github.io/atom-node/LocalStore.html)  
You can replace it with a custom backlog using the same interface
```js
const AtomTracker = require('atom-node').Tracker;
const params = {
  backlog: YourCustomBacklogClass()
}
let tracker = new AtomTracker(params);
```

### Tracker Logger
The tracker is using a simple logger based on console, you can replace it with your own (bunyan for example)
```js
const AtomTracker = require('atom-node').Tracker;
const params = {
  logger: myLoggerModule
}
let tracker = new AtomTracker(params);
```

### Low Level (Basic) SDK
The Low Level SDK has 2 methods:  
- putEvent - Sends a single event to Atom  
- putEvents - Sends a bulk (batch) of events to Atom (must be an array)
```js
'use strict';
const AtomReporter = require('atom-node').ISAtom;
const options = {
  endpoint: "https://track.atom-data.io/",
  auth: "YOUR_API_KEY"
};

let atom = new AtomReporter(options);
let params = {
  stream: "STREAM_NAME", // Your target stream name
  data: JSON.stringify({name: "iron", last_name: "Source"}), // Object / Stringified Json
}
// With co (POST):
co(function*() {
  try {
    let res = yield atom.putEvent(params);
    console.log(`[Example PutEvent POST] success: ${res.message} ${res.status}`);
  } catch (err) {
    console.log(`[Example PutEvent POST] failure: ${err.message} ${err.status}`);
  }
});
  
// With Promises
params.method = 'POST';
atom.putEvent(params).then(function (res) {
  console.log(`[Example PutEvent POST] success: ${res.message} ${res.status}`);
}).catch(function (err) {
  console.log(`[Example PutEvent POST] failure: ${err.message} ${err.status}`);
});

// PutEvents (batch):
let batchPayload = {
  stream: "STREAM_NAME", // Your target stream name
  data: [{name: "iron", last_name: "Beast"},
    {name: "iron2", last_name: "Beast2"}], // Array with Json / Stringified Json
};
atom.putEvents(batchPayload).then(function (res) {
  console.log(`[Example PutEvents POST] success: ${res.message} ${res.status}`);
}, function (err) {
  console.log(`[Example PutEvents POST] failure: ${err.message} ${err.status}`);
});
```

## Change Log

### v1.6.0
- Changed flow control to make it more clear and reliable (see [Usage](#usage))
- Removed FlushOnExit param - tracker will always try to flush on exit
- Added a tracking timeout option - works only on non-blocking mode
- Added a blocking / non-blocking toggle.
- Tracker flush mechanism now emits events on: stop, first retry, empty & error
- onError callback replaced with "error" event.

### v1.5.2
- Fixed broken headers
- Added more parameters to the onError func
- Added Limits to SDK Bulk Length and Bulk Size & Flush Interval

### v1.5.1
- Updated npm package conf
- Updated readme
- Changed project directory structure

### v1.5.0
- Refactored Request class
- Refactored Atom class
- Refactored Tracker
- Fixed a bug in Tracker exit handler (there was no delay on graceful shutdown)
- Added an option to add a callback on error (after max retries reached)
- Changed example
- Added more options to conf
- Rewrote all tests and increased coverage
- Updated README
- Updated all docs and changed them from apiDoc to JSDoc
- Fixed a bug with headers not being sent
- Added AtomError custom Error

### v1.2.0
- Fixed tracker retry bug - caused by mutating an object that was passed by reference
- increased test coverage
- Updated README.MD

### v1.1.2
- Fixed tests and removed unused dependencies
- Updated tests to run on LTS

### v1.1.0
- Added tracker
- Added Backoff mechanism

### v1.0.0
- Basic features: putEvent & putEvents functionalities

## Example
You can use our [example][example-url] for sending data to Atom.
```bash
node example/example.js -h

  Usage: example [options]

  Options:

    -h, --help       output usage information
    -V, --version    output the version number
    -p, --putevent   Run the putEvent examples
    -P, --putevents  Run the putEvents examples
    -H, --health     run the health check example
    -t, --tracker    run the tracker example
    -a, --all        Run all of the examples
```

## License
[MIT](LICENSE)

[example-url]: example/example.js
[license-image]: https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square
[license-url]: LICENSE
[travis-image]: https://travis-ci.org/ironSource/atom-node.svg?branch=master
[travis-url]: https://travis-ci.org/ironSource/atom-node
[coveralls-image]: https://coveralls.io/repos/github/ironSource/atom-node/badge.svg?branch=master
[coveralls-url]: https://coveralls.io/github/ironSource/atom-node?branch=master
[docs-image]: https://img.shields.io/badge/docs-latest-blue.svg
[docs-url]: https://ironsource.github.io/atom-node/
[npm-image]: https://badge.fury.io/js/atom-node.svg 
[npm-url]: https://badge.fury.io/js/atom-node
