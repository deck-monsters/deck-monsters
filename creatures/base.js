const { EventEmitter, globalSemaphore } = require('../helpers/semaphore');

const TIME_TO_HEAL = 900000;

class BaseCreature {
	constructor (options) {
		if (this.name === BaseCreature.name) {
			throw new Error('The BaseCreature should not be instantiated directly!');
		}

		this.semaphore = new EventEmitter();
		this.options = options;
		this.healingInterval = setInterval(() => {
			if (this.hp < this.maxHp) this.heal(1);
		}, TIME_TO_HEAL);
	}

	get name () {
		return this.constructor.name;
	}

	get options () {
		return this.optionsStore || {};
	}

	set options (options) {
		this.optionsStore = Object.assign({}, this.options, options);

		this.emit('updated', this);
	}

	get hp () {
		return this.options.hp || 0;
	}

	set hp (hp) {
		this.options = {
			hp
		};
	}

	get xp () {
		return this.options.xp || 0;
	}

	set xp (xp) {
		this.options = {
			xp
		};
	}

	get ac () {
		// TO-DO: This should actually calculate based on xp, items, etc
		return this.options.ac || 0;
	}

	get accuracyModifier () {
		// TO-DO: This should actually calculate based on xp, items, etc
		return this.options.accuracyModifier || '';
	}

	get damageModifier () {
		// TO-DO: This should actually calculate based on xp, items, etc
		return this.options.damageModifier || '';
	}

	get maxHp () {
		// TO-DO: This should actually calculate based on xp, items, etc
		return this.options.maxHp || 0;
	}

	emit (event, ...args) {
		this.semaphore.emit(event, this.name, ...args);
		globalSemaphore.emit(`creature.${event}`, this.name, ...args);
	}

	on (...args) {
		this.semaphore.on(...args);
	}

	hit (damage = 0, assailant) {
		const hp = this.hp - damage;

		this.emit('hit', { assailant, damage, hp, prevHp: this.hp });

		if (hp <= 0) {
			this.hp = 0;
			this.die();
		} else {
			this.hp = hp;
		}
	}

	heal (amount = 0) {
		const hp = this.hp + amount;

		this.emit('heal', { amount, hp, prevHp: this.hp });

		if (hp <= 0) {
			this.hp = 0;
			this.die();
		} else if (hp > this.maxHp) {
			this.hp = this.maxHp;
		} else {
			this.hp = hp;
		}
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

module.exports = BaseCreature;
