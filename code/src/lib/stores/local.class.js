/**
 * Created by idoschachter on 17/07/2016.
 */
'use strict';

module.exports = class LocalStore {
  constructor() {
    this.data = {};
  }

  /**
   * registers data in the store for a given key, if it doesn't exist yet it's created
   * @param key
   * @param value
   * @returns {*}
   */
  add(key, value) {
    if (!this.data[key]) {
      this.data[key] = [];
    }
    this.data[key].push(value);
    return this.get(key);
  }

  /**
   * returns data for a given key
   * the difference between get and take is that get leaves data in the store
   * @param key
   * @returns {*}
   */
  get(key) {
    return this.data[key];
  }

  /**
   * will take the value for a given key and empty the value from the store
   * useful for flushing the data
   * @param key
   * @returns {*|Array.<T>}
   */
  take(key) {
    let data = this.get(key);
    if (!data) {
      throw new Error(`${key} does not exist in the store`);
    }
    return data.splice(0);
  }

  /**
   * indicates whether there's no data for a given key
   * @param key
   * @returns {*|boolean}
   */
  isEmpty(key) {
    let data = this.get(key);
    return !data || data.length <= 0;
  }

  /**
   * returns all keys for the given store
   * @returns {Array}
   */
  get keys() {
    return Object.keys(this.data);
  }
};