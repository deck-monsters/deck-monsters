const EventEmitter = require('event-emitter-es6');

const globalSemaphore = new EventEmitter();

module.exports = {
	EventEmitter,
	globalSemaphore
};
