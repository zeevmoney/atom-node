# ironSource.atom SDK for JavaScript
[![License][license-image]][license-url]
[![Docs][docs-image]][docs-url]
[![Build status][travis-image]][travis-url]
[![Coveralls][coveralls-image]][coveralls-url]

atom-nodeJs is the official [ironSource.atom](http://www.ironsrc.com/data-flow-management) SDK for the NodeJS programming language.

- [Signup](https://atom.ironsrc.com/#/signup)
- [Documentation](https://ironsource.github.io/atom-node/)
- [Installation](#Installation)
- [Sending an event](#Using-the-API-layer-to-send-events)

#### Installation
```sh
$ npm install --save atom-sdk-node
```
##### Add script file
```js
// ...
const IronSourceAtom = require('atom-sdk-node');
```

#### Using the API layer to send events

Here's an example of sending an event:
```js
const options = {
  endpoint: "https://track.atom-data.io/",
  auth: "YOUR_API_KEY"
}

let atom = new IronSourceAtom(options);

let params = {
  stream: "STREAM_NAME", //your target stream name
  data: JSON.stringify({name: "iron", last_name: "Source"}), //String with any data and any structure.
}

atom.putEvent(params).then(function(response){
  console.log(response);
}, function(reject) {
  console.log(reject);
});

// or

let params = {
  stream: "STREAM_NAME", // your target stream name
  data: [{name: "iron", last_name: "Beast"},
         {name: "iron2", last_name: "Beast2"}], // Array with any data and any structure.
}

atom.putEvents(params); // for send bulk of events
```

### Example

You can use our [example][example-url] for sending data to Atom:

### License
MIT

[example-url]: https://github.com/ironSource/atom-node/blob/master/atom-node/code/example/example.js
[license-image]: https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square
[license-url]: LICENSE
[travis-image]: https://travis-ci.org/ironSource/atom-node.svg?branch=master
[travis-url]: https://travis-ci.org/ironSource/atom-node
[coveralls-image]: https://coveralls.io/repos/github/ironSource/atom-node/badge.svg?branch=master
[coveralls-url]: https://coveralls.io/github/ironSource/atom-node?branch=master
[docs-image]: https://img.shields.io/badge/docs-latest-blue.svg
[docs-url]: https://ironsource.github.io/atom-node/
