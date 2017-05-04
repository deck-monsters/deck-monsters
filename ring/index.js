const shuffle = require('lodash.shuffle');

const { EventEmitter, globalSemaphore } = require('../helpers/semaphore');

const MAX_MONSTERS = 2;

class Ring {
	constructor (channel, options) {
		this.semaphore = new EventEmitter();
		this.setOptions(options);
		this.ringChannel = channel;

		this.emit('initialized');
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

	get monsters () {
		return this.options.monsters || [];
	}

	addMonster (monster) {
		if (this.monsters.length < MAX_MONSTERS) {
			this.options.monsters = shuffle([...this.monsters, monster]);
		}

		this.emit('add', { monster });

		if (this.monsters.length > MAX_MONSTERS) {
			this.clearRing();
		} else if (this.monsters.length === MAX_MONSTERS) {
			this.fight();
		}
	}

	clearRing () {
		this.options.monsters = [];
		this.emit('clear');
	}

	fight () {
		this.emit('fight', { monsters: this.monsters });
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

module.exports = Ring;
