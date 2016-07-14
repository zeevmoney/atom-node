'use strict';

/*
 * Request Class
 * The purpose of this class is to wrap all requests sent to the atom API
 * in order to grantee a unified response syntax (for higher level SDK functions to use)
 * and to format requests according to the api specification.
 * */

const config = require('./../config');
const Promise = require('bluebird');
const request = require('request');
const crypto = require('crypto');
const logger = require('./logger');

module.exports = class Request {
    constructor(endpoint, params) {
        if (params === 'health') {
            return this.health(endpoint);
        }
        this.params = params;
        this.logger = params.logger || logger;
        return this.params.method == 'GET' ? this.get(endpoint) : this.post(endpoint);
    };

    _fetch(method, options) {
        return new Promise((resolve, reject) => {
            request[method](options, (err, res, body) => {
                if (err) {
                    return reject(err);
                } else {
                    return resolve(body);
                }
            });
        });
    }

    get(endpoint) {
        // Generate the HMAC auth
        this.params.auth = !!this.params.auth
            ? crypto.createHmac('sha256', this.params.auth).update(this.params.data).digest('hex')
            : '';

        // Table will be replace with Stream in V2 of the api.
        this.params.table = this.params.stream;

        if (this.params.bulk) {
            return Promise.reject({message: 'Bad Request, Sending Bulks with GET is not allowed ', status: 400});
        }

        let payload = {data: new Buffer(JSON.stringify(this.params)).toString('base64')};
        let options = {
            url: endpoint,
            headers: this.headers,
            json: true,
            qs: payload
        };
        return this._fetch('get', options)
            .spread(function (response, body) {
                let out = {message: body, status: response.statusCode};
                if (response.statusCode >= 400) {
                    throw out;
                }
                return out;
            })
            .catch(function (err) {
                if (err.status >= 400) {
                    return Promise.reject(err);
                }
                logger.error(err);
                return Promise.reject({message: 'Connection Problem', status: 400});
            });
    }


    post(endpoint) {

        // Generate the HMAC auth
        this.params.auth = !!this.params.auth
            ? crypto.createHmac('sha256', this.params.auth).update(this.params.data).digest('hex')
            : '';

        // Table will be replace with stream in V2 of the api.
        this.params.table = this.params.stream;
        let options = {
            url: this.params.bulk ? endpoint + "/bulk" : endpoint,
            headers: this.headers,
            json: true,
            body: this.params
        };
        return this._fetch('post', options)
            .spread(function (response, body) {
                let out = {message: body, status: response.statusCode};
                if (response.statusCode >= 400) {
                    throw out;
                }
                return out;
            })
            .catch(function (err) {
                if (err.status >= 400) {
                    return Promise.reject(err);
                }
                logger.error(err);
                return Promise.reject({message: 'Connection Problem', status: 400});
            });
    }

    health(endpoint) {
        /* istanbul ignore next */
        let options = {
            url: endpoint + '/health',
            headers: this.headers,
            json: true
        };
        return this._fetch('get', options)
            .spread(function (response, body) {
                if (response.statusCode >= 400) {
                    throw {message: "Atom API is down", status: response.statusCode}
                }
                return {message: "Atom API is up", status: response.statusCode}
            })
            .catch(function (err) {
                if (err.status >= 400) {
                    return Promise.reject(err)
                }
                logger.error(err);
                return Promise.reject({message: 'Connection Problem', status: 400});
            });
    }

};