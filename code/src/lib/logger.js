'use strict';
const bunyan = require('bunyan');
const PrettyStream = require('bunyan-prettystream');

let prettyStdOut = new PrettyStream();
prettyStdOut.pipe(process.stdout);

module.exports = bunyan.createLogger({
  name: 'Atom',
  serializers: bunyan.stdSerializers,
  src: true,
  streams: [
    {
      stream: prettyStdOut,
      level: 'trace'
    }
  ]
});