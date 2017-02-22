'use strict';

/**
 * This class implements a Tracker in-memory backlog
 * @type {LocalStore}
 */

class LocalStore {
  constructor(backlogSize) {
    this.data = {};
    this.size = backlogSize;
  }

  /**
   * Registers data in the store for a given stream, if it doesn't exist yet it's created
   * @param {String} stream - Atom stream name
   * @param {(String|Object)} data - Payload to be sent
   * @returns {boolean}
   */
  add(stream, data) {
    if (!this.data[stream]) {
      this.data[stream] = [];
    }
    if (this.data[stream].length >= this.size) {
      return false;
    }
    this.data[stream].push(data);
    return true;
  }

  /**
   * Returns data for a given stream
   * the difference between get and take is that get leaves data in the store
   * @param {String} stream - Atom stream name
   * @returns {?Array}
   */
  get(stream) {
    return this.data[stream];
  }

  /**
   * Will take the value for a given stream and empty the value from the store
   * useful for flushing the data
   * @param {String} stream - Atom stream name
   * @param {Number} [amount] - amount of events to take
   * @returns {!Array}
   */
  take(stream, amount) {
    let data = this.get(stream);
    if (!data) {
      /* istanbul ignore next */
      return [];
    }
    if (amount) {
      return data.splice(0, amount);
    } else {
      return data.splice(0);
    }
  }

  /**
   * Indicates whether there's no data for a given stream
   * @param {String} stream - Atom stream name
   * @returns {Boolean} true if empty, else false
   */
  isEmpty(stream) {
    let data = this.get(stream);
    return !data || data.length <= 0;
  }

  /**
   * Returns all stream names for current storage
   * @returns {!Array}
   */
  get keys() {
    return Object.keys(this.data);
  }
}

module.exports = LocalStore;