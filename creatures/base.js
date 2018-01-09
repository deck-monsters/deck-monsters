const random = require('lodash.random');
const sample = require('lodash.sample');
const startCase = require('lodash.startcase');

const BaseClass = require('../baseClass');

const { signedNumber } = require('../helpers/signed-number');
const { getLevel } = require('../helpers/levels');
const { STARTING_XP } = require('../helpers/experience');
const names = require('../helpers/names');
const pause = require('../helpers/pause');
const PRONOUNS = require('../helpers/pronouns');

const BASE_AC = 5;
const AC_VARIANCE = 2;
const BASE_HP = 28;
const HP_VARIANCE = 5;
const MAX_AC_BOOST = (BASE_AC * 2) + AC_VARIANCE;
const MAX_AC_MODIFICATION = 4;
const MAX_ATTACK_BOOST = 10;
const MAX_DAMAGE_BOOST = 6;
const MAX_HP_BOOST = (BASE_HP * 2) + HP_VARIANCE;
const MAX_HP_MODIFICATION = 12;
const TIME_TO_HEAL = 300000; // Five minutes per hp
const TIME_TO_RESURRECT = 600000; // Ten minutes per level

class BaseCreature extends BaseClass {
	constructor ({
		acVariance = random(0, AC_VARIANCE),
		hpVariance = random(0, HP_VARIANCE),
		gender = sample(Object.keys(PRONOUNS)),
		DEFAULT_AC, // legacy
		DEFAULT_HP, // legacy
		...options
	} = {}) {
		super({ acVariance, hpVariance, gender, ...options });

		// Clean up old AC code
		if (DEFAULT_AC) {
			this.setOptions({
				acVariance: DEFAULT_AC - 5
			});
		}

		// Clean up old HP code
		if (DEFAULT_HP) {
			this.setOptions({
				hpVariance: DEFAULT_HP - 23
			});
		}

		if (this.name === BaseCreature.name) {
			throw new Error('The BaseCreature should not be instantiated directly!');
		}

		this.healingInterval = setInterval(() => {
			if (this.hp < this.maxHp && !this.inEncounter && !this.dead) this.heal(1);
		}, TIME_TO_HEAL);

		if (this.respawnTimeoutBegan) {
			this.respawn();
		}
	}

	get maxModifications () {
		return {
			hp: MAX_HP_MODIFICATION,
			ac: MAX_AC_MODIFICATION,
			xp: Math.max(this.getPreBattlePropValue('xp') - 40, 0)
		};
	}

	get class () {
		return this.constructor.class;
	}

	get creatureType () {
		return this.constructor.creatureType;
	}

	get icon () {
		return this.options.icon;
	}

	get givenName () {
		if (!this.options.name) {
			this.setOptions({
				name: names(this.creatureType, this.gender)
			});
		}

		return startCase(this.options.name);
	}

	get identity () {
		return `${this.icon} ${this.givenName}`;
	}

	get identityWithHp () {
		return `${this.identity} (${this.hp} hp)`;
	}

	get stats () {
		return `Type: ${this.creatureType}
Class: ${this.class}
Level: ${this.level || this.displayLevel} | XP: ${this.xp}
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

	get isBoss () {
		return this.options.isBoss;
	}

	get pronouns () {
		return PRONOUNS[this.options.gender];
	}

	get acVariance () {
		return this.options.acVariance + (this.constructor.acVariance || 0);
	}

	get hpVariance () {
		return this.options.hpVariance + (this.constructor.hpVariance || 0);
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

	get bloodiedValue () {
		return Math.floor(this.maxHp / 2);
	}

	get bloodied () {
		return this.hp <= this.bloodiedValue;
	}

	set bloodied (hp) {
		this.setOptions({
			hp: this.bloodiedValue
		});
	}

	get destroyed () {
		return this.hp < -this.bloodiedValue;
	}

	get maxHp () {
		let maxHp = BASE_HP + this.hpVariance;
		maxHp += Math.min(this.level * 3, MAX_HP_BOOST); // Gain 3 hp per level up to the max
		maxHp += Math.min(this.modifiers.maxHp || 0, MAX_HP_MODIFICATION);

		return Math.max(maxHp, 1);
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

	get respawnTimeoutBegan () {
		return this.options.respawnTimeoutBegan || 0;
	}

	set respawnTimeoutBegan (respawnTimeoutBegan) {
		this.setOptions({
			respawnTimeoutBegan
		});
	}

	get xp () {
		let xp = this.getPreBattlePropValue('xp');
		xp += this.modifiers.xp || 0;

		return Math.max(xp, 0);
	}

	set xp (xp) {
		this.setOptions({
			xp
		});
	}

	get coins () {
		return this.options.coins || 0;
	}

	set coins (coins) {
		this.setOptions({
			coins
		});
	}

	get items () {
		if (!this.options.items) this.items = [];

		return this.options.items;
	}

	set items (items) {
		this.setOptions({
			items
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

	get fled () {
		return !!(this.encounter || {}).fled;
	}

	set fled (fled) {
		this.encounter = {
			...this.encounter,
			fled
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

	get round () {
		return (this.encounter || {}).round || 1;
	}

	set round (round) {
		this.encounter = {
			...this.encounter,
			round
		};
	}

	get killedBy () {
		return (this.encounter || {}).killedBy;
	}

	set killedBy (creature) {
		this.encounter = {
			...this.encounter,
			killedBy: creature
		};
	}

	get killed () {
		return (this.encounter || {}).killedCreatures || [];
	}

	set killed (creature) {
		this.encounter = {
			...this.encounter,
			killedCreatures: [...this.killed, creature]
		};
	}

	get level () {
		return getLevel(this.xp);
	}

	get displayLevel () {
		const level = getLevel(this.xp);
		return level ? `level ${level}` : 'beginner';
	}

	get ac () {
		let ac = this.getPreBattlePropValue('ac');
		ac += Math.min(this.modifiers.ac || 0, MAX_AC_MODIFICATION);

		return Math.max(ac, 1);
	}

	getPreBattlePropValue (prop) {
		let raw;

		switch (prop) {
			case 'ac':
				raw = BASE_AC + this.acVariance;
				raw += Math.min(this.level, MAX_AC_BOOST); // +1 to AC per level up to the max
				break;
			case 'hp':
				raw = this.maxHp;
				break;
			case 'xp':
				raw = this.options.xp || STARTING_XP;
				break;
			default:
		}

		return raw;
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

		attackModifier += Math.min(this.modifiers.attackModifier || 0, MAX_ATTACK_BOOST);

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

		damageModifier += Math.min(this.modifiers.damageModifier || 0, MAX_DAMAGE_BOOST);

		return damageModifier;
	}

	canHold () { // eslint-disable-line class-methods-use-this
		return false;
	}

	canHoldCard (card) {
		return this.canHold(card);
	}

	canHoldItem (item) {
		return this.canHold(item);
	}

	leaveCombat (activeContestants) {
		this.emit('leave', {
			activeContestants
		});

		this.fled = true;

		return false;
	}

	hit (damage = 0, assailant, card) {
		if (this.hp < 1) return false;

		const hp = this.hp - damage;
		const originalHP = this.hp;

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
		if (this.hp > 0) {
			this.hp = 0;
		}

		if (assailant instanceof BaseCreature) {
			if (!this.killedBy) { // You can only be killed by one monster
				assailant.killed = this;
				this.killedBy = assailant;

				this.emit('die', {
					destroyed: this.destroyed,
					assailant
				});
			}
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
		const { encounter = {} } = this;

		this.inEncounter = false;
		delete this.encounter;

		return encounter;
	}

	respawn (immediate) {
		const now = Date.now();
		const timeoutLength = (immediate) ? 0 : this.level * TIME_TO_RESURRECT;

		if (immediate || !this.respawnTimeout) {
			// TO-DO: Possibly do some other checks for whether this monster should respawn
			const creature = this;

			this.respawnTimeoutBegan = this.respawnTimeoutBegan || now;
			this.respawnTimeoutLength = Math.max((this.respawnTimeoutBegan + timeoutLength) - now, 0);

			this.respawnTimeout = pause.setTimeout(() => {
				creature.hp = Math.max(1, creature.hp);
				creature.respawnTimeout = undefined;
				creature.respawnTimeoutBegan = undefined;

				creature.emit('respawn');
			}, timeoutLength);
		}

		return this.respawnTimeoutBegan + timeoutLength;
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
