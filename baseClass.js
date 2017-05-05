const { EventEmitter, globalSemaphore } = require('./helpers/semaphore');

class BaseClass {
	constructor (options) {
		if (this.name === BaseClass.name) {
			throw new Error('The BaseClass should not be instantiated directly!');
		}

		if (!this.eventPrefix) {
			throw new Error('An eventPrefix is required.');
		}

		this.semaphore = new EventEmitter();
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
	}

	emit (event, ...args) {
		this.semaphore.emit(event, this.name, this, ...args);
		globalSemaphore.emit(`${this.eventPrefix}.${event}`, this.name, this, ...args);
	}

	on (event, func) {
		this.semaphore.on(event, func.bind(this));
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
