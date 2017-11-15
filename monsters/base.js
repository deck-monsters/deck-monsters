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
`The current value of ${key} is ${this.options[key]}. What would you like the new value of ${key} to be?`
			})
				.then((strVal) => {
					const oldVal = this.options[key];
					const numberVal = +strVal;

					if (!isNaN(numberVal)) { // eslint-disable-line no-restricted-globals
						this.options[key] = numberVal;
					} else {
						this.options[key] = strVal;
					}

					return { key, oldVal, newVal: this.options[key] };
				}))
			.then(({ key, oldVal, newVal }) => channel({
				question:
`The value of ${key} has been updated from ${oldVal} to ${newVal}. Would you like to keep this change? (yes/no)`
			})
				.then((answer = '') => {
					if (answer.toLowerCase() !== 'yes') {
						this.options[key] = oldVal;

						return channel({ announce: 'Change reverted.' });
					}

					return Promise.resolve();
				}));
	}

	look (channel) {
		return Promise
			.resolve()
			.then(() => channel({ announce: monsterCard(this, true) }));
	}
}

module.exports = BaseMonster;
