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

	get defaults () {
		return this.constructor.defaults;
	}

	get options () {
		return {
			...this.defaults,
			...this.optionsStore
		};
	}

	setOptions (options) {
		const optionsStore = {
			...this.optionsStore,
			...options
		};

		Object.keys(optionsStore).forEach((key) => {
			if (optionsStore[key] === undefined) {
				delete optionsStore[key];
			}
		});

		this.optionsStore = optionsStore;

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
		const { defaults, options } = this;

		if (defaults) {
			Object.keys(defaults).forEach((key) => {
				if (options[key] === defaults[key]) {
					delete options[key];
				}
			});
		}

		return {
			name: this.name,
			options
		};
	}

	toString () {
		return JSON.stringify(this);
	}
}

module.exports = BaseClass;
