const random = require('lodash.random');
const sample = require('lodash.sample');
const startCase = require('lodash.startcase');

const BaseClass = require('../shared/baseClass');

const { describeLevels, getLevel } = require('../helpers/levels');
const { getAttributeChoices } = require('../helpers/choices');
const { sortItemsAlphabetically } = require('../items/helpers/sort');
const { STARTING_XP } = require('../helpers/experience');
const isMatchingItem = require('../items/helpers/is-matching');
const names = require('../helpers/names');
const pause = require('../helpers/pause');
const PRONOUNS = require('../helpers/pronouns');

const {
	AC_VARIANCE,
	BASE_AC,
	BASE_DEX,
	BASE_HP,
	BASE_INT,
	BASE_STR,
	HP_VARIANCE,
	MAX_BOOSTS,
	MAX_PROP_MODIFICATIONS
} = require('../helpers/stat-constants');

const TIME_TO_HEAL = 300000; // Five minutes per hp
const TIME_TO_RESURRECT = 600000; // Ten minutes per level
const DEFAULT_ITEM_SLOTS = 12;

class BaseCreature extends BaseClass {
	constructor ({
		acVariance = random(0, AC_VARIANCE),
		hpVariance = random(0, HP_VARIANCE),
		gender = sample(Object.keys(PRONOUNS)),
		xp = 0,
		...options
	} = {}) {
		super({ acVariance, hpVariance, gender, xp, ...options });

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
Level: ${this.level || this.displayLevel} | XP: ${this.xp}`;
	}

	get targetingStrategy () {
		return this.options.targetingStrategy || undefined;
	}

	set targetingStrategy (targetingStrategy) {
		this.setOptions({
			targetingStrategy
		});
	}

	get maxHp () {
		let maxHp = BASE_HP + this.hpVariance;
		maxHp += Math.min(this.level * 3, MAX_BOOSTS.hp); // Gain 3 hp per level up to the max
		maxHp += Math.min(this.modifiers.maxHp || 0, this.getMaxModifications('hp'));

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

	get level () {
		return getLevel(this.xp);
	}

	get displayLevel () {
		return describeLevels(this.level).description;
	}

	get xp () {
		return this.getProp('xp');
	}

	set xp (xp) {
		this.setOptions({
			xp
		});
	}

	get ac () {
		return this.getProp('ac');
	}

	get dex () {
		return this.getProp('dex');
	}

	get str () {
		return this.getProp('str');
	}

	get int () {
		return this.getProp('int');
	}

	get dexModifier () {
		return this.getModifier('dex');
	}

	get strModifier () {
		return this.getModifier('str');
	}

	get intModifier () {
		return this.getModifier('int');
	}

	getMaxModifications (prop) {
		switch (prop) {
			case 'hp':
				return MAX_PROP_MODIFICATIONS.hp;
			case 'ac':
				return Math.ceil(MAX_PROP_MODIFICATIONS.ac * (this.level + 1));
			case 'xp':
				return Math.max(this.getPreBattlePropValue('xp') - MAX_PROP_MODIFICATIONS.xp, MAX_PROP_MODIFICATIONS.xp);// can't use level for calculation because it would cause circular reference
			case 'int':
				return Math.ceil(MAX_PROP_MODIFICATIONS.int * (this.level + 1));
			case 'str':
				return Math.ceil(MAX_PROP_MODIFICATIONS.str * (this.level + 1));
			case 'dex':
				return Math.ceil(MAX_PROP_MODIFICATIONS.dex * (this.level + 1));
			default:
				return 4;
		}
	}

	getProp (targetProp) {
		let prop = this.getPreBattlePropValue(targetProp);
		prop += Math.min(this.encounterModifiers[targetProp] || 0, this.getMaxModifications(targetProp));

		return Math.max(prop, 1);
	}

	getPreBattlePropValue (prop) {
		let raw;

		switch (prop) {
			case 'dex':
				raw = BASE_DEX + this.dexModifier;
				raw += Math.min(this.level, MAX_BOOSTS[prop]); // +1 to DEX per level up to the max
				break;
			case 'str':
				raw = BASE_STR + this.strModifier;
				raw += Math.min(this.level, MAX_BOOSTS[prop]); // +1 to STR per level up to the max
				break;
			case 'int':
				raw = BASE_INT + this.intModifier;
				raw += Math.min(this.level, MAX_BOOSTS[prop]); // +1 to INT per level up to the max
				break;
			case 'ac':
				raw = BASE_AC + this.acVariance;
				raw += Math.min(this.level, MAX_BOOSTS[prop]); // +1 to AC per level up to the max
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

	getModifier (targetProp) {
		const targetModifier = `${targetProp}Modifier`;
		let modifier = this.options[targetModifier] || 0;

		const boost = Math.min(this.level, MAX_BOOSTS[targetProp]);
		if (boost > 0) {
			modifier += boost; // +1 per level up to the max
		}

		modifier += Math.min(this.modifiers[modifier] || 0, MAX_BOOSTS[targetProp]);

		return modifier;
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

	get respawnTimeoutBegan () {
		return this.options.respawnTimeoutBegan || 0;
	}

	set respawnTimeoutBegan (respawnTimeoutBegan) {
		this.setOptions({
			respawnTimeoutBegan
		});
	}

	get cards () {
		if (!Array.isArray(this.options.cards)) this.cards = [];

		return this.options.cards;
	}

	set cards (cards) {
		this.setOptions({
			cards
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

	get itemSlots () { // eslint-disable-line class-methods-use-this
		return DEFAULT_ITEM_SLOTS;
	}

	get items () {
		if (!Array.isArray(this.options.items)) this.items = [];

		return this.options.items;
	}

	set items (items) {
		this.setOptions({
			items
		});
	}

	get encounterModifiers () {
		if (!this.encounter) this.encounter = {};
		if (!this.encounter.modifiers) this.encounter.modifiers = {};

		return this.encounter.modifiers;
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

	canHold () { // eslint-disable-line class-methods-use-this
		return false;
	}

	canHoldCard (card) {
		return this.canHold(card);
	}

	canHoldItem (item) {
		return this.canHold(item);
	}

	canUseItem (item) {
		return this.canHoldItem(item);
	}

	addItem (item) {
		this.items = sortItemsAlphabetically([...this.items, item]);

		this.emit('itemAdded', { item });
	}

	removeItem (itemToRemove) {
		const itemIndex = this.items.findIndex(item => isMatchingItem(item, itemToRemove));

		if (itemIndex >= 0) {
			const foundItem = this.items.splice(itemIndex, 1)[0];

			this.emit('itemRemoved', { item: foundItem });

			return foundItem;
		}

		return undefined;
	}

	giveItem (itemToGive, recipient) {
		const item = this.removeItem(itemToGive);

		if (item) {
			recipient.addItem(item);

			this.emit('itemGiven', { item, recipient });
		}
	}

	useItem ({ channel, channelName, character = this, item, monster }) {
		let foundItem;

		if (monster) {
			foundItem = monster.items.find(potentialItem => isMatchingItem(potentialItem, item));
		}

		if (!foundItem) {
			// Monsters in an encounter can only use items they are carrying
			if (monster && monster.inEncounter) {
				return Promise.reject(channel({
					announce: `${monster.givenName} doesn't seem to be holding that item.`
				}));
			}

			foundItem = character.items.find(potentialItem => isMatchingItem(potentialItem, item));
		}

		if (foundItem) {
			return foundItem.use({ channel, channelName, character, monster });
		}

		return Promise.reject(channel({
			announce: `${character.givenName} doesn't seem to be holding that item.`
		}));
	}

	leaveCombat (activeContestants) {
		this.emit('leave', {
			activeContestants
		});

		this.fled = true;

		return false;
	}

	/* assailant is the monster who attacked you, not the contestant who owns the monster */
	hit (damage = 0, assailant, card) {
		const hitLog = this.encounterModifiers.hitLog || [];
		hitLog.unshift({
			assailant,
			damage,
			card,
			when: Date.now()
		});
		this.encounterModifiers.hitLog = hitLog;

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

		if (originalHP > 0 && hp <= 0) {
			return this.die(assailant);
		}

		return !this.dead;
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
			return this.die(this);
		}

		return true;
	}

	setModifier (attr, amount = 0, permanent = false) {
		const prevValue = (permanent) ? this.modifiers[attr] || 0 : this.encounterModifiers[attr] || 0;
		const modifiers = Object.assign({}, (permanent) ? this.modifiers : this.encounterModifiers, {
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
				if (assailant !== this) assailant.killed = this;
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

	edit (channel) {
		return Promise
			.resolve()
			.then(() => this.look && this.look(channel))
			.then(() => channel({
				question:
`Which attribute would you like to edit?

${getAttributeChoices(this.options)}`,
				choices: Object.keys(Object.keys(this.options))
			}))
			.then(index => Object.keys(this.options)[index])
			.then(key => channel({
				question:
`The current value of ${key} is ${JSON.stringify(this.options[key])}. What would you like the new value of ${key} to be?`
			})
				.then((strVal) => {
					const oldVal = this.options[key];
					let newVal;

					try {
						newVal = JSON.parse(strVal);
					} catch (ex) {
						newVal = +strVal;

						if (isNaN(newVal)) { // eslint-disable-line no-restricted-globals
							newVal = strVal;
						}
					}

					return { key, oldVal, newVal };
				}))
			.then(({ key, oldVal, newVal }) => channel({
				question:
`The value of ${key} has been updated from ${JSON.stringify(oldVal)} to ${JSON.stringify(newVal)}. Would you like to keep this change? (yes/no)` // eslint-disable-line max-len
			})
				.then((answer = '') => {
					if (answer.toLowerCase() === 'yes') {
						this.setOptions({
							[key]: newVal
						});

						return channel({ announce: 'Change saved.' });
					}

					return channel({ announce: 'Change reverted.' });
				}));
	}
}

BaseCreature.eventPrefix = 'creature';

module.exports = BaseCreature;
