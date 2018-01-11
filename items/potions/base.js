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

	get used () {
		return this.options.used || 0;
	}

	set used (used) {
		this.setOptions({
			used
		});
	}

	use (character, monster) {
		this.emit('used', {
			character,
			monster
		});

		// Generally speaking once something has been used the player will drop it but we'll increment
		// a counter instead of boolean just in case the item can be used more than once
		this.used += 1;

		if (this.effect) {
			return this.effect(character, monster);
		}

		return this.used;
	}
}

BasePotion.eventPrefix = 'potion';

module.exports = BaseItem;
