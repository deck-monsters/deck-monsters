const BaseCreature = require('../creatures/base');

const { monsterCard } = require('../helpers/card');

const DEFAULT_CARD_SLOTS = 3;

class BaseMonster extends BaseCreature {
	constructor (options) {
		super(options);

		if (this.name === BaseMonster.name) {
			throw new Error('The BaseMonster should not be instantiated directly!');
		}
	}

	get cards () {
		if (this.options.cards === undefined) this.cards = [];

		return this.options.cards || [];
	}

	set cards (cards) {
		this.setOptions({
			cards
		});
	}

	get cardSlots () {
		if (this.options.cardSlots === undefined) this.cardSlots = DEFAULT_CARD_SLOTS;
		const cardSlots = this.options.cardSlots || 0;
		const level = this.level || 0;

		return cardSlots + level;
	}

	set cardSlots (cardSlots) {
		this.setOptions({
			cardSlots
		});
	}

	look (channel) {
		return Promise
			.resolve()
			.then(() => channel({ announce: monsterCard(this, true) }));
	}
}

module.exports = BaseMonster;
