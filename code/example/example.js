'use strict';
// for npm -> require('atom-node');

const ISAtom = require('../src');
let atom = new ISAtom({
  auth: ''
});

atom.putEvent({"table": "ibtest", "data": "test"}).then(function(res){
  console.log('PutEvent POST success:', res);
}).catch(function(err){
  console.log('PutEvent POST:', err);
});

atom.health().then(function(res) {
  console.log("Health: Server on this url is up");
}, function(rej) {
  console.log("Health: Server on this url is down");
});

atom.putEvents({"table": "ibtest", "data": ["asd"]}).then(function(res){
  console.log('PutEvents success:', res);
}).catch(function(err){
  console.log('PutEvents error:', err);
});
