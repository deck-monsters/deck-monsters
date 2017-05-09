const BaseCreature = require('../creatures/base');
const { getInitialDeck } = require('../cards');

class BaseCharacter extends BaseCreature {
	constructor (options) {
		const defaultOptions = {
			deck: getInitialDeck()
		};

		super(Object.assign(defaultOptions, options));

		if (this.name === BaseCharacter.name) {
			throw new Error('The BaseCharacter should not be instantiated directly!');
		}
	}

	get deck () {
		if (this.options.deck === undefined || this.options.deck.length <= 0) {
			this.deck = getInitialDeck();
		}

		return this.options.deck || [];
	}

	set deck (deck) {
		this.setOptions({
			deck
		});
	}

	addCard (card) {
		this.deck = [...this.deck, card];

		this.emit('cardAdded', { card });
	}
}

module.exports = BaseCharacter;
