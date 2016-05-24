'use strict';

const ISAtom = require('../src');
let atom = new ISAtom({
  auth: 'asdadad341dzdf3125'
});

atom.putEvent({"table": "ibtest", "data": "test"}).then(function(res){
  console.log('PutEvents POST success:');
  console.log(res);
}).catch(function(err){
  console.log('PutEvents POST error:');
  console.log(err);
});

atom.putEvent({"tabe": "ibtest","data": "asd", "method": "GET"}).then(function(res){
  console.log('PutEvents GET success:');
  console.log(res);
}).catch(function(e){
  console.log('PutEvents GET error:');
  console.log(e);
});
