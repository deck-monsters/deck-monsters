const EventEmitter = require('event-emitter-es6');

const semaphore = new EventEmitter();

module.exports = semaphore;
