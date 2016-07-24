'use strict';

const EventEmitter = require('events');

class MyEmitter extends EventEmitter {
}

const myEmitter = new MyEmitter();

myEmitter.on('FLUSH')
myEmitter.on('TRACK', () => {
    console.log('an event occurred!');
    if (shouldFlush){
        myEmitter.emit('FLUSH');
    }
});