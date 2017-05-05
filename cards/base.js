const { EventEmitter, globalSemaphore } = require('../helpers/semaphore');

class BaseCard {
	constructor (options) {
		if (this.name === BaseCard.name) {
			throw new Error('The BaseCard should not be instantiated directly!');
		}

		this.semaphore = new EventEmitter();
		this.setOptions(options);

		this.emit('created');
	}

	get name () {
		return this.constructor.name;
	}

	get options () {
		return this.optionsStore || {};
	}

	get cardType () {
		return this.constructor.cardType;
	}

	setOptions (options) {
		this.optionsStore = Object.assign({}, this.options, options);

		this.emit('updated');
	}

	look (channel) {
		return Promise
			.resolve()
			.then(() => channel({
				announce:
`${this.constructor.cardType}: ${this.constructor.description}
Stats: ${this.stats}`
			}));
	}

	emit (event, ...args) {
		this.semaphore.emit(event, this.name, this, ...args);
		globalSemaphore.emit(`card.${event}`, this.name, this, ...args);
	}

	on (...args) {
		this.semaphore.on(...args);
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

module.exports = BaseCard;
