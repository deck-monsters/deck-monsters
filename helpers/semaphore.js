const EventEmitter = require('event-emitter-es6');

const globalSemaphore = new EventEmitter({ emitDelay: 0 });

module.exports = {
	EventEmitter,
	globalSemaphore
};
