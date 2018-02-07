const BaseCreature = require('../creatures/base');

const {
	getUniqueCards,
	sortCardsAlphabetically
} = require('../cards');
const { actionCard, monsterCard } = require('../helpers/card');
const { signedNumber } = require('../helpers/signed-number');
const { getStrategyDescription } = require('../helpers/targeting-strategies');
const isMatchingItem = require('../items/helpers/is-matching');

const DEFAULT_CARD_SLOTS = 9;
const DEFAULT_ITEM_SLOTS = 3;

class BaseMonster extends BaseCreature {
	constructor (options) {
		super(options);

		if (this.name === BaseMonster.name) {
			throw new Error('The BaseMonster should not be instantiated directly!');
		}
	}

	get hand () {
		return this.cards;
	}

	set hand (hand) {
		this.cards = hand;
	}

	get cardSlots () { // eslint-disable-line class-methods-use-this
		// if (this.options.cardSlots === undefined) this.cardSlots = DEFAULT_CARD_SLOTS;
		// const cardSlots = this.options.cardSlots || 0;

		return DEFAULT_CARD_SLOTS; // enforce default for now
	}

	set cardSlots (cardSlots) {
		this.setOptions({
			cardSlots
		});
	}

	get itemSlots () { // eslint-disable-line class-methods-use-this
		return DEFAULT_ITEM_SLOTS;
	}

	get stats () {
		const bonuses = [];

		if (this.dexModifier !== 0) {
			bonuses.push(`${signedNumber(this.dexModifier)} dex ${this.dexModifier > 0 ? 'bonus' : 'penalty'}`.trim());
		}
		if (this.strModifier !== 0) {
			bonuses.push(`${signedNumber(this.strModifier)} str ${this.strModifier > 0 ? 'bonus' : 'penalty'}`.trim());
		}
		if (this.intModifier !== 0) {
			bonuses.push(`${signedNumber(this.intModifier)} int ${this.intModifier > 0 ? 'bonus' : 'penalty'}`.trim());
		}

		return `${super.stats}

ac: ${this.ac} | hp: ${this.hp}/${this.maxHp}
dex: ${this.dex} | str: ${this.str} | int: ${this.int}
${bonuses.join('\n')}${
	!this.targetingStrategy ? '' :
		`
Strategy: ${getStrategyDescription(this.targetingStrategy)}`
}`;
	}

	canHold (object) {
		const appropriateLevel = (!object.level || object.level <= this.level);
		const appropriateClassOrType = (
			!object.permittedClassesAndTypes
			|| object.permittedClassesAndTypes.includes(this.class)
			|| object.permittedClassesAndTypes.includes(this.creatureType)
		);

		return appropriateLevel && appropriateClassOrType;
	}

	resetCards ({ matchCard } = {}) {
		const shouldReset = !matchCard || !!this.cards.find(card => isMatchingItem(card, matchCard));

		if (shouldReset) this.cards = [];
	}

	get emptyHanded () {
		return !!(this.encounter || {}).emptyHanded;
	}

	set emptyHanded (emptyHanded) {
		this.encounter = {
			...this.encounter,
			emptyHanded
		};
	}

	startEncounter (ring) {
		super.startEncounter(ring);

		this.items.forEach(item => item.onStartEncounter && item.onStartEncounter({ monster: this, ring }));
	}

	endEncounter () {
		this.items.forEach(item => item.onEndEncounter && item.onEndEncounter({ monster: this, ring: this.encounter.ring }));

		super.endEncounter();
	}

	look (channel, inDetail) {
		return Promise
			.resolve()
			.then(() => channel({ announce: monsterCard(this, true) }))
			.then(() => inDetail && this.lookAtCards(channel, inDetail));
	}

	lookAtCards (channel, inDetail) {
		let cards = [...this.cards];

		if (!inDetail) {
			const sortedDeck = sortCardsAlphabetically(cards);
			cards = getUniqueCards(sortedDeck);
		}

		let announce;

		if (cards.length > 0) {
			announce = cards.reduce((previousCards, card) =>
				previousCards + actionCard(card), 'Cards:\n');
		} else {
			announce = `${this.givenName}'s hand is empty.`;
		}

		return Promise
			.resolve()
			.then(() => channel({
				announce
			}));
	}
}

module.exports = BaseMonster;
