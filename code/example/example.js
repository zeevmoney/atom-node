'use strict';

const ISAtom = require('../src');
let atom = new ISAtom({
  auth: ''
});

atom.putEvent({"table": "ibstest", "data": "test"}).then(function(res){
  console.log('PutEvents POST success:');
  console.log(res);
}).catch(function(err){
  console.log('PutEvents POST error:');
  console.log(err);
});

atom.putEvent({"table": "ibtest","data": "asd", "method": "GET"}).then(function(res){
  console.log('PutEvents GET success:');
  console.log(res);
}).catch(function(e){
  console.log('PutEvents GET error:');
  console.log(e);
});
