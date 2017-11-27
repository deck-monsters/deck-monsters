const random = require('lodash.sample');
const startCase = require('lodash.startcase');

const BaseClass = require('../baseClass');
const { STARTING_XP, getLevel } = require('../helpers/levels');
const PRONOUNS = require('../helpers/pronouns');
const { signedNumber } = require('../helpers/signed-number');
const pause = require('../helpers/pause');

const BASE_AC = 5;
const AC_VARIANCE = 2;
const BASE_HP = 23;
const HP_VARIANCE = 5;
const MAX_AC_BOOST = (BASE_AC * 2) + AC_VARIANCE;
const MAX_ATTACK_BOOST = 10;
const MAX_DAMAGE_BOOST = 6;
const MAX_HP_BOOST = (BASE_HP * 2) + HP_VARIANCE;
const TIME_TO_HEAL = 300000; // Five minutes per hp
const TIME_TO_RESURRECT = 1800000; // Half-hour per level

class BaseCreature extends BaseClass {
	constructor (options) {
		const defaultOptions = {
			gender: random(Object.keys(PRONOUNS)),
			DEFAULT_HP: Math.ceil(Math.random() * HP_VARIANCE) + BASE_HP,
			DEFAULT_AC: Math.ceil(Math.random() * AC_VARIANCE) + BASE_AC
		};

		super(Object.assign(defaultOptions, options));

		if (this.name === BaseCreature.name) {
			throw new Error('The BaseCreature should not be instantiated directly!');
		}

		this.healingInterval = setInterval(() => {
			if (this.hp < this.maxHp && !this.inEncounter && !this.dead) this.heal(1);
		}, TIME_TO_HEAL);
	}

	get class () {
		return this.constructor.class;
	}

	get icon () {
		return this.options.icon;
	}

	get givenName () {
		return startCase(this.options.name);
	}

	get identity () {
		return `${this.icon}  ${this.givenName}`;
	}

	get identityWithHp () {
		return `${this.identity} (${this.hp} hp)`;
	}

	get stats () {
		return `Level: ${this.level} | XP: ${this.xp}
AC: ${this.ac} | HP: ${this.hp}/${this.maxHp}${
	this.attackModifier === 0 ? '' :
		`
${signedNumber(this.attackModifier)} to hit`
}${
	this.damageModifier === 0 ? '' :
		`
${signedNumber(this.damageModifier)} to damage`
}`;
	}

	get rankings () {
		return `Battles fought: ${this.battles.total}
Battles won: ${this.battles.wins}`;
	}

	get individualDescription () {
		return this.options.description || this.description;
	}

	get gender () {
		return this.options.gender;
	}

	get pronouns () {
		return PRONOUNS[this.options.gender];
	}

	get DEFAULT_HP () {
		return this.options.DEFAULT_HP;
	}

	get DEFAULT_AC () {
		return this.options.DEFAULT_AC;
	}

	get battles () {
		if (this.options.battles === undefined) this.battles = { wins: 0, losses: 0, total: 0 };

		return this.options.battles || [];
	}

	set battles (battles) {
		this.setOptions({
			battles
		});
	}

	get dead () {
		return this.hp <= 0;
	}

	set dead (dead) {
		if (dead !== this.dead) {
			if (dead && !this.dead) {
				this.die({ identityWithHp: 'mysterious causes' });
			} else if (!dead && this.dead) {
				this.respawn();
			}
		}
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

	get encounterModifiers () {
		return (this.encounter || {}).modifiers || {};
	}

	set encounterModifiers (modifiers = {}) {
		this.encounter = {
			...this.encounter,
			modifiers
		};
	}

	get encounterEffects () {
		return (this.encounter || {}).effects || [];
	}

	set encounterEffects (effects = []) {
		this.encounter = {
			...this.encounter,
			effects
		};
	}

	get modifiers () {
		return {
			...this.options.modifiers,
			...this.encounterModifiers
		};
	}

	set modifiers (modifiers) {
		this.setOptions({
			modifiers
		});
	}

	get level () {
		return getLevel(this.xp);
	}

	get ac () {
		let ac = this.options.ac || this.DEFAULT_AC;
		ac += Math.min(this.level, MAX_AC_BOOST); // +1 to AC per level up to the max
		ac += this.modifiers.ac || 0;

		return ac;
	}

	// We don't have this right now
	// get bonusAttackDice () {
	// 	return undefined;
	// }

	get attackModifier () {
		let attackModifier = this.options.attackModifier || 0;

		const boost = Math.min(this.level, MAX_ATTACK_BOOST);
		if (boost > 0) {
			attackModifier += boost; // +1 per level up to the max
		}
		attackModifier += this.modifiers.attackModifier || 0;

		return attackModifier;
	}

	// We don't have this right now
	// get bonusDamageDice () {
	// 	return undefined;
	// }

	get damageModifier () {
		let damageModifier = this.options.damageModifier || 0;

		const boost = Math.min(this.level, MAX_DAMAGE_BOOST);
		if (boost > 0) {
			damageModifier += boost; // +1 per level up to the max
		}
		damageModifier += this.modifiers.damageModifier || 0;

		return damageModifier;
	}

	get maxHp () {
		let maxHp = this.options.maxHp || this.DEFAULT_HP;
		maxHp += Math.min(this.level * 2, MAX_HP_BOOST); // Gain 2 hp per level up to the max
		maxHp += this.modifiers.maxHp || 0;

		return maxHp;
	}

	canHoldCard () { // eslint-disable-line class-methods-use-this
		return false;
	}

	leaveCombat (assailant) {
		this.emit('leave', {
			assailant
		});

		return false;
	}

	hit (damage = 0, assailant, card) {
		const hp = this.hp - damage;
		const originalHP = this.hp;

		if (hp <= 0) {
			this.hp = 0;
		}

		this.hp = hp;

		this.emit('hit', {
			assailant,
			card,
			damage,
			hp,
			prevHp: originalHP
		});

		if (hp <= 0) {
			return this.die(assailant);
		}

		return true;
	}

	heal (amount = 0) {
		const hp = this.hp + amount;
		const originalHP = this.hp;

		if (hp <= 0) {
			this.hp = 0;
		} else if (hp > this.maxHp) {
			this.hp = this.maxHp;
		} else {
			this.hp = hp;
		}

		this.emit('heal', {
			amount,
			hp,
			prevHp: originalHP
		});

		if (hp <= 0) {
			return this.die();
		}

		return true;
	}

	setModifier (attr, amount = 0, permanent = false) {
		const prevValue = this.modifiers[attr] || 0;
		const modifiers = Object.assign({}, this.modifiers, {
			[attr]: prevValue + amount
		});

		if (permanent) {
			this.modifiers = modifiers;
		} else {
			this.encounterModifiers = modifiers;
		}

		this.emit('modifier', {
			amount,
			attr,
			prevValue
		});
	}

	die (assailant) {
		this.emit('die', {
			assailant
		});

		if (this.hp > 0) {
			this.hp = 0;
		}

		return false;
	}

	startEncounter (ring) {
		this.inEncounter = true;
		this.encounter = {
			ring
		};
	}

	endEncounter () {
		this.inEncounter = false;
		delete this.encounter;
	}

	respawn (immediate) {
		if (immediate || !this.respawnTimeout) {
			// TO-DO: Possibly do some other checks for whether this monster should respawn
			const creature = this;
			const timeoutLength = (immediate) ? 0 : this.level * TIME_TO_RESURRECT;

			this.respawnTimeoutBegan = Date.now();
			this.respawnTimeoutLength = timeoutLength;

			this.respawnTimeout = pause.setTimeout(() => {
				creature.hp = 1;
				creature.respawnTimeout = undefined;

				creature.emit('respawn');
			}, timeoutLength);
		}

		return this.respawnTimeoutBegan + this.respawnTimeoutLength;
	}

	addWin () {
		const battles = {
			wins: this.battles.wins + 1,
			losses: this.battles.losses,
			total: this.battles.total + 1
		};

		this.battles = battles;
	}

	addLoss () {
		const battles = {
			wins: this.battles.wins,
			losses: this.battles.losses + 1,
			total: this.battles.total + 1
		};

		this.battles = battles;
	}

	addDraw () {
		const battles = {
			wins: this.battles.wins,
			losses: this.battles.losses,
			total: this.battles.total + 1
		};

		this.battles = battles;
	}
}

BaseCreature.eventPrefix = 'creature';

module.exports = BaseCreature;
