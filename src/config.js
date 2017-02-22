module.exports = {
  API_VERSION: 'V1',
  END_POINT: "https://track.atom-data.io/",
  AUTH: '',
  DEBUG: false,
  LOGGER: require('./lib/logger'),
  // Tracker Config:
  FLUSH_INTERVAL: 10 * 1000,
  BULK_LENGTH: 250,
  BULK_LENGTH_LIMIT: 2000,
  BULK_SIZE: 128 * 1024,
  BULK_SIZE_LIMIT: 512 * 1024,
  // Number of concurrent requests
  CONCURRENCY: 10,
  REQUESTS_IN_FLIGHT: 2,
  HEADERS: {
    'x-ironsource-atom-sdk-type': 'V1.5.2',
    'x-ironsource-atom-sdk-version': 'node-js'
  },
  BACKLOG_SIZE: 20000 //todo set to bulk length limit
};
