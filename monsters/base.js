const BaseCreature = require('../creatures/base');

const {
	getUniqueCards,
	sortCardsAlphabetically
} = require('../cards');
const { actionCard, monsterCard } = require('../helpers/card');
const { getAttributeChoices } = require('../helpers/choices');
const isMatchingItem = require('../items/helpers/is-matching');

const DEFAULT_CARD_SLOTS = 9;

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

	edit (channel) {
		return Promise
			.resolve()
			.then(() => channel({ announce: monsterCard(this, true) }))
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

	look (channel, inDetail) {
		return Promise
			.resolve()
			.then(() => channel({ announce: monsterCard(this, true) }))
			.then(() => this.lookAtCards(channel, inDetail));
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
