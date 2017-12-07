const BaseClass = require('../baseClass');

const { itemCard } = require('../helpers/card');

class BaseItem extends BaseClass {
	constructor (options) {
		super(options);

		if (this.name === BaseItem.name) {
			throw new Error('The BaseItem should not be instantiated directly!');
		}
	}

	get itemType () {
		return this.constructor.itemType;
	}

	get description () {
		return this.constructor.description;
	}

	get icon () {
		return this.options.icon;
	}

	get cost () {
		return this.constructor.cost;
	}

	get level () {
		return this.constructor.level;
	}

	get permittedClasses () {
		return this.constructor.permittedClasses;
	}

	get probability () {
		return this.constructor.probability;
	}

	get flavors () {
		return this.constructor.flavors || this.options.flavors;
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

	look (channel) {
		return Promise
			.resolve()
			.then(() => channel({
				announce: itemCard(this)
			}));
	}
}

BaseItem.eventPrefix = 'item';

module.exports = BaseItem;
