'use strict';

const ISAtom = require('../src');
let atom = new ISAtom({
  auth: ''
});

atom.putEvent({"table": "ibtest", "data": "test"}).then(function(res){
  console.log('PutEvent POST success:', res);
}).catch(function(err){
  console.log('PutEvent POST:', err);
});

atom.putEvent({"table": "ibtest","data": "asd", "method": "GET"}).then(function(res){
  console.log('PutEvent GET success:', res);
}).catch(function(err){
  console.log('PutEvent GET error:', err);
});

atom.health().then(function(res) {
  console.log("Health: Server on this url is up");
}, function(rej) {
  console.log("Health: Server on this url is down");
});

atom.putEvents({"table": "ibtest", "data": ["asd"]}).then(function(res){
  console.log('PutEvents POST success:', res);
}).catch(function(err){
  console.log('PutEvents POST error:', err);
});
