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

	use (character, monster) {
		this.emit('used', {
			character,
			monster
		});

		if (this.effect) {
			return this.effect(character, monster);
		}

		return true;
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
