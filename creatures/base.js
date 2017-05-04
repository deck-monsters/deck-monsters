const random = require('lodash.sample');

const { EventEmitter, globalSemaphore } = require('../helpers/semaphore');
const { STARTING_XP, getLevel } = require('../helpers/levels');
const PRONOUNS = require('../helpers/pronouns');

const DEFAULT_AC = 6;
const DEFAULT_MAX_HP = 6;
const MAX_AC_BOOST = DEFAULT_AC;
const MAX_ACCURACY_BOOST = 10;
const MAX_DAMAGE_BOOST = 6;
const MAX_HP_BOOST = 20;
const TIME_TO_HEAL = 900000;

class BaseCreature {
	constructor (options) {
		if (this.name === BaseCreature.name) {
			throw new Error('The BaseCreature should not be instantiated directly!');
		}

		const defaultOptions = {
			gender: random(Object.keys(PRONOUNS))
		};

		this.semaphore = new EventEmitter();
		this.setOptions(Object.assign(defaultOptions, options));
		this.conditions = {};// These need to be cleared at the **END** of each battle

		this.healingInterval = setInterval(() => {
			if (this.hp < this.maxHp) this.heal(1);
		}, TIME_TO_HEAL);

		this.emit('created');
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

	get givenName () {
		return this.options.name;
	}

	get individualDescription () {
		return this.options.description;
	}

	get gender () {
		return this.options.gender;
	}

	get pronouns () {
		return PRONOUNS[this.options.gender];
	}

	get dead () {
		return this.options.dead || false;
	}

	set dead (dead) {
		this.setOptions({
			dead
		});
	}

	get hp () {
		if (this.options.hp === undefined) this.hp = this.maxHp;

		return this.options.hp;
	}

	set hp (hp) {
		this.setOptions({
			hp
		});
	}

	get xp () {
		return this.options.xp || STARTING_XP;
	}

	set xp (xp) {
		this.setOptions({
			xp
		});
	}

	get level () {
		return getLevel(this.xp);
	}

	get ac () {
		let ac = this.options.ac || DEFAULT_AC;
		ac += Math.min(this.level, MAX_AC_BOOST); // +1 to AC per level up to the max
		ac += this.conditions.ac || 0;

		return ac;
	}

	get accuracyModifier () {
		let accuracyModifier = this.options.accuracyModifier || '';

		const boost = Math.min(this.level, MAX_ACCURACY_BOOST);
		if (boost > 0) {
			accuracyModifier += `+${boost}d4`; // +1d4 per level up to the max
		}

		return accuracyModifier;
	}

	get damageModifier () {
		let damageModifier = this.options.damageModifier || '';
		const numericDamageModifer = Number((damageModifier.match(/^(?:\+|-)([\d]+)$/) || [0, 0])[1]);

		const boost = Math.min(this.level, MAX_DAMAGE_BOOST);
		if (boost > 0) {
			damageModifier = `+${boost + numericDamageModifer}${damageModifier}`; // +1 per level up to the max
		}

		return damageModifier;
	}

	get maxHp () {
		let maxHp = this.options.maxHp || DEFAULT_MAX_HP;
		maxHp += Math.min(this.level * 2, MAX_HP_BOOST); // Gain 2 hp per level up to the max

		return maxHp;
	}

	emit (event, ...args) {
		this.semaphore.emit(event, this.name, this, ...args);
		globalSemaphore.emit(`creature.${event}`, this.name, this, ...args);
	}

	on (...args) {
		this.semaphore.on(...args);
	}

	leaveCombat (assailant) {
		this.emit('leave', { assailant });
	}

	hit (damage = 0, assailant) {
		const hp = this.hp - damage;

		this.emit('hit', { assailant, damage, hp, prevHp: this.hp });

		if (hp <= 0) {
			this.hp = 0;
			this.die(assailant);
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

	condition (attr = 'ac', amount = 0) {
		const originalAttr = this[attr];
		this.conditions[attr] += amount;

		this.emit('condition', { attr, amount, originalAttr, creature: this });
	}

	die (assailant) {
		this.emit('die', { assailant });

		this.hp = 0;
		this.dead = true;
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
