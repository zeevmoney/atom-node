"use strict";
// Simple logger, you can replace it with bunyan or anything else...
let enabled = true;
module.exports = {
  error: function () {
    console.error.apply(this, arguments);
  },
  warn: function () {
    console.warn.apply(this, arguments);
  },
  info: function () {
    console.info.apply(this, arguments);
  },
  debug: function () {
    if (enabled) {
      console.log.apply(this, arguments);
    }
  },
  trace: function () {
    if (enabled) {
      console.log.apply(this, arguments);
    }
  },
  toggleLogger: function (newState) {
    enabled = newState;
  }
};