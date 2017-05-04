const BaseCreature = require('../creatures/base');
const { getInitialDeck } = require('../cards');

const DEFAULT_MONSTER_SLOTS = 2;

class BasePlayer extends BaseCreature {
	// constructor (options) {
	// 	super(options);
	// }

	get deck () {
		if (this.options.deck === undefined) this.deck = getInitialDeck();

		return this.options.deck || [];
	}

	set cards (deck) {
		this.options = {
			deck
		};
	}

	get monsters () {
		return this.options.monsters || [];
	}

	set monsters (monsters) {
		this.options = {
			monsters
		};
	}

	get monsterSlots () {
		if (this.options.monsterSlots === undefined) this.monsterSlots = DEFAULT_MONSTER_SLOTS;

		return this.options.monsterSlots || 0;
	}

	set monsterSlots (monsterSlots) {
		this.options = {
			monsterSlots
		};
	}

	addCard (card) {
		this.cards = [...this.cards, card];
	}
}

module.exports = BasePlayer;
