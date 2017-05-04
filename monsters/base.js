const BaseCreature = require('../creatures/base');

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
		this.options = {
			cards
		};
	}

	look (callback) {
		return Promise
			.resolve()
			.then(() => callback({
				announce: `You see ${this.individualDescription}'`
			}));
	}
}

module.exports = BaseMonster;
