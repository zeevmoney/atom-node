'use strict';

function logger() {}

logger.err = function(message) {
  throw new Error(message);
};

module.exports = logger;