const BaseCreature = require('../creatures/base');

const { monsterCard } = require('../helpers/card');
const { getAttributeChoices } = require('../helpers/choices');

const DEFAULT_CARD_SLOTS = 7;

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

	canHoldCard (card) {
		const appropriateLevel = (!card.level || card.level <= this.level);
		const appropriateClass = (!card.permittedClasses || card.permittedClasses.includes(this.class));

		return appropriateLevel && appropriateClass;
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

	look (channel) {
		return Promise
			.resolve()
			.then(() => channel({ announce: monsterCard(this, true) }));
	}
}

module.exports = BaseMonster;
