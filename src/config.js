module.exports = {
  API_VERSION: 'V1',
  END_POINT: "https://track.atom-data.io/",
  AUTH: '',
  DEBUG: false,
  LOGGER: require('./lib/logger'),
  // Tracker Config:
  IS_BLOCKING: true,
  TRACKING_TIMEOUT: 10 * 1000,
  FLUSH_INTERVAL: 10 * 1000,
  BULK_LENGTH: 250,
  BULK_LENGTH_LIMIT: 2000,
  BACKLOG_SIZE: 2000,
  BULK_SIZE: 128 * 1024,
  BULK_SIZE_LIMIT: 512 * 1024,
  // Number of concurrent requests
  CONCURRENCY: 2,
  MAX_REQUESTS_IN_FLIGHT: 2,
  HEADERS: {
    'x-ironsource-atom-sdk-type': 'V1.6.0',
    'x-ironsource-atom-sdk-version': 'node-js'
  }
};
