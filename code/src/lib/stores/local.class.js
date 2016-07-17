/**
 * Created by idoschachter on 17/07/2016.
 */
'use strict';

module.exports = class LocalStore {
  constructor() {
    this.data = {};
  }

  add(key, value) {
    if (!this.data[key]) {
      this.data[key] = [];
    }
    this.data[key].push(value);
  }

  get(key) {
    return this.data[key];
  }

  isEmpty(key) {
    let data = this.get(key);
    return data && data.length <= 0;
  }

  take(key) {
    return this.get(key).splice(0);
  }
};