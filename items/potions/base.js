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

	get numberOfUses () {
		return this.constructor.numberOfUses;
	}

	get expired () {
		const { numberOfUses, used = 0 } = this;

		return !!(numberOfUses && used >= numberOfUses);
	}

	get stats () {
		const { numberOfUses } = this;

		if (numberOfUses === 1) {
			return 'Usable 1 time.';
		} else if (numberOfUses > 1) {
			return `Usable ${numberOfUses} times.`;
		}

		return 'Usable an unlimited number of times.';
	}

	use (character, monster) {
		super.use(character, monster);

		if (this.expired) {
			character.removeItem(this);
		}
	}
}

BasePotion.eventPrefix = 'potion';

module.exports = BasePotion;
