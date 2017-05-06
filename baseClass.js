const { EventEmitter, globalSemaphore } = require('./helpers/semaphore');

class BaseClass {
	constructor (options, semaphore = new EventEmitter({ emitDelay: 0 })) {
		if (this.name === BaseClass.name) {
			throw new Error('The BaseClass should not be instantiated directly!');
		}

		if (!this.eventPrefix) {
			throw new Error('An eventPrefix is required.');
		}

		this.semaphore = semaphore;
		this.setOptions(options);

		this.emit('created');
	}

	get eventPrefix () {
		return this.constructor.eventPrefix;
	}

	get name () {
		return this.constructor.name;
	}

	get options () {
		return this.optionsStore || {};
	}

	setOptions (options) {
		this.optionsStore = Object.assign({}, this.options, options);

		this.emit('updated');
		globalSemaphore.emit('stateChange');
	}

	emit (event, ...args) {
		this.semaphore.emit(event, this.name, this, ...args);
		globalSemaphore.emit(`${this.eventPrefix}.${event}`, this.name, this, ...args);
	}

	on (event, func) {
		const boundFunc = func.bind(this);

		this.semaphore.on(event, boundFunc);

		return boundFunc; // Useful if you want to be able to call `off` on this event
	}

	off (event, func) {
		this.semaphore.off(event, func);
	}

	toJSON () {
		return {
			name: this.name,
			options: this.options
		};
	}

	toString () {
		return JSON.stringify(this);
	}
}

module.exports = BaseClass;
