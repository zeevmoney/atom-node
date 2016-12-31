# ironSource.atom SDK for Node
[![License][license-image]][license-url]
[![Docs][docs-image]][docs-url]
[![Coverage Status][coveralls-image]][coveralls-url]
[![Build status][travis-image]][travis-url]

atom-node is the official [ironSource.atom](http://www.ironsrc.com/data-flow-management) SDK for Node.JS Javascript runtime

- [Signup](https://atom.ironsrc.com/#/signup)
- [Documentation](https://ironsource.github.io/atom-node/)
- [Installation](#installation)
- [Usage](#usage)
- [Change Log](#change-log)
- [Example](#example)

## Installation

### Installation using npm
```sh
$ npm install --save
```

## Usage

### High Level API - "Tracker"
The tracker is used for sending events to Atom based on several conditions
- Every 10 seconds (default)
- Number of accumulated events has reached 10000 (default)
- Size of accumulated events has reached 64Kb (default)
```js
const AtomTracker = require('atom-node').Tracker;
const params = {
  endpoint: "https://track.atom-data.io/",
  auth: "YOUR_API_KEY",
  flushInterval: 10, // Optional, Flushing interval in seconds
  bulkLen: 1000, // Optional, Max count for events to send
  bulkSize: 64, // Optional, Max size of data in Kb
  onError: (data) => {
    console.log(`failed sending ${data}`); // Optional,  Will be called after max retries fail.
  }
}
let tracker = new AtomTracker(params);
let payload = {"id": 123, "strings": "abcd"};
tracker.track("STREAM NAME", payload); // Track an event
tracker.flush(); // Flush immediately
```

### Low Level API
```js
const AtomReporter = require('atom-node').ISAtom;
const options = {
  endpoint: "https://track.atom-data.io/",
  auth: "YOUR_API_KEY"
};

let atom = new AtomReporter(options);

let params = {
  stream: "STREAM_NAME", // Your target stream name
  data: JSON.stringify({name: "iron", last_name: "Source"}), // Json / Stringified Json
}

atom.putEvent(params).then(function(response){
  console.log(response);
}, function(reject) {
  console.log(reject);
});

// OR

let params = {
  stream: "STREAM_NAME", // Your target stream name
  data: [{name: "iron", last_name: "Beast"},
         {name: "iron2", last_name: "Beast2"}], // Array with Json / Stringified Json
}
atom.putEvents(params); // for send bulk of events
```

todo: explain about logger and localstore

## Change Log

### v1.5.0
- Added an option to add a callback on error (after max retries reached)
- Updated coverage
- Updated README
- Updated docs and changed them from apiDoc to JSDoc
- Fixed a bug with headers not being sent
- Refactored Request class

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

### Example

You can use our [example][example-url] for sending data to Atom.

## License
[MIT](LICENSE)

[example-url]: https://github.com/ironSource/atom-node/blob/master/code/example/example.js
[license-image]: https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square
[license-url]: LICENSE
[travis-image]: https://travis-ci.org/ironSource/atom-node.svg?branch=master
[travis-url]: https://travis-ci.org/ironSource/atom-node
[coveralls-image]: https://coveralls.io/repos/github/ironSource/atom-node/badge.svg?branch=master
[coveralls-url]: https://coveralls.io/github/ironSource/atom-node?branch=master
[docs-image]: https://img.shields.io/badge/docs-latest-blue.svg
[docs-url]: https://ironsource.github.io/atom-node/
