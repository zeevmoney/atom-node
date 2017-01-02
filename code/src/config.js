module.exports = {
  SDK_VERSION: 'V1.5.0',
  API_VERSION: 'V1',
  SDK_TYPE: 'node-js',
  END_POINT: "https://track.atom-data.io/",
  AUTH: '',
  DEBUG: false,
  LOGGER: require('./lib/logger'),
  // Tracker Config:
  FLUSH_INTERVAL: 10 * 1000,
  BULK_LENGTH: 1000,
  BULK_SIZE: 128 * 1024,
  // Number of concurrent requests
  CONCURRENCY: 10
};
