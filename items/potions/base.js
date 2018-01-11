const BaseItem = require('../base');

class BasePotion extends BaseItem {
	constructor (options) {
		super(options);

		if (this.name === BasePotion.name) {
			throw new Error('The BasePotion should not be instantiated directly!');
		}
	}

	get potionType () {
		return this.itemType;
	}
}

BasePotion.eventPrefix = 'potion';

module.exports = BasePotion;
