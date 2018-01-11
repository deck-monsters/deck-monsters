const reduce = require('lodash.reduce');

const BaseCreature = require('../creatures/base');

const { actionCard, monsterCard } = require('../helpers/card');
const {
	getInitialDeck,
	getUniqueCards,
	isMatchingCard,
	sortCards
} = require('../cards');
const getCardCounts = require('../items/helpers/counts');

class BaseCharacter extends BaseCreature {
	constructor (options = {}) {
		const defaultOptions = {
			deck: []
		};

		super(Object.assign(defaultOptions, options));

		if (this.name === BaseCharacter.name) {
			throw new Error('The BaseCharacter should not be instantiated directly!');
		}
	}

	get cards () {
		if (this.options.deck === undefined || this.options.deck.length <= 0) {
			this.deck = getInitialDeck(undefined, this);
		}

		return this.options.deck || [];
	}

	set cards (deck) {
		this.setOptions({
			deck
		});
	}

	get deck () {
		return this.cards;
	}

	set deck (deck) {
		this.cards = deck;
	}

	canHold (object) {
		const appropriateLevel = (!object.level || object.level <= this.level);

		return appropriateLevel;
	}

	addCard (card) {
		this.deck = [...this.deck, card];

		this.emit('cardAdded', { card });
	}

	removeCard (cardToRemove) {
		let isAlreadyRemoved = false;
		this.deck = this.deck.filter((card) => {
			const shouldKeepCard = isAlreadyRemoved || !isMatchingCard(card, cardToRemove);

			if (!shouldKeepCard) isAlreadyRemoved = true;

			return shouldKeepCard;
		});

		this.emit('cardRemoved', { cardToRemove });
	}

	lookAtMonsters (channel, description) {
		const monstersDisplay = this.monsters.reduce((monsters, monster) => monsters + monsterCard(monster, description), '');

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
		const sortedDeck = sortCards([...this.deck]);
		const cardImages = getUniqueCards(sortedDeck).reduce((cards, card) =>
			cards + actionCard(card), '');

		const cardCounts = reduce(getCardCounts(sortedDeck), (counts, count, card) =>
			`${counts}${card} (${count})
`, '');


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
