const BaseCreature = require('../creatures/base');
const { getInitialDeck, getUniqueCards, getCardCounts } = require('../cards');
const { formatCard, monsterCard } = require('../helpers/card');
const foreach = require('lodash.foreach');

class BaseCharacter extends BaseCreature {
	constructor (options) {
		const defaultOptions = {
			deck: getInitialDeck(options)
		};

		super(Object.assign(defaultOptions, options));

		if (this.name === BaseCharacter.name) {
			throw new Error('The BaseCharacter should not be instantiated directly!');
		}
	}

	get deck () {
		if (this.options.deck === undefined || this.options.deck.length <= 0) {
			this.deck = getInitialDeck(this.options);
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

	lookAtMonsters (channel) {
		const monstersDisplay = this.monsters.reduce((monsters, monster) => monsters + monsterCard(monster, true), '');

		if (monstersDisplay) {
			return Promise
				.resolve()
				.then(() => channel({
					announce: monstersDisplay
				}));
		}

		return Promise.reject(channel({
			announce: 'You do not currently have any monsters.',
			delay: 'short'
		}));
	}

	lookAtCards (channel) {
		const cardImages = getUniqueCards(this.deck).reduce((cards, card) =>
			cards + formatCard({
				title: `${card.icon}  ${card.cardType}`,
				description: card.description,
				stats: card.stats
			}), '');

		let cardCounts = '';
		foreach(getCardCounts(this.deck), (count, card) => {
			cardCounts += `${card} (${count})
`;
		});


		const deckDisplay = `${cardImages} ${cardCounts}`;

		if (deckDisplay) {
			return Promise
				.resolve()
				.then(() => channel({
					announce: deckDisplay
				}));
		}

		return Promise.reject(channel({
			announce: "Strangely enough, somehow you don't have any cards.",
			delay: 'short'
		}));
	}
}

module.exports = BaseCharacter;
