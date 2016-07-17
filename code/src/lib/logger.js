module.exports = {
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.log,
  trace: function () {
    console.log.apply(this, arguments);
  }
};