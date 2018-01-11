const BasePotion = require('../potions/base');

class BaseScroll extends BasePotion {
	constructor (options) {
		super(options);

		if (this.name === BaseScroll.name) {
			throw new Error('The BaseScroll should not be instantiated directly!');
		}
	}

	get scrolType () {
		return this.itemType;
	}
}

BaseScroll.eventPrefix = 'scroll';

module.exports = BaseScroll;
