const BaseClass = require('../baseClass');

class BaseCard extends BaseClass {
	constructor (options) {
		super(options);

		if (this.name === BaseCard.name) {
			throw new Error('The BaseCard should not be instantiated directly!');
		}
	}

	get cardType () {
		return this.constructor.cardType;
	}

	play (player, target, ring) {
		this.emit('played', {
			player,
			target,
			ring
		});

		if (this.effect) {
			return this.effect(player, target, ring);
		}

		return true;
	}

	look (channel) {
		return Promise
			.resolve()
			.then(() => channel({
				announce:
`${this.constructor.cardType}: ${this.constructor.description}
Stats: ${this.stats}`
			}));
	}
}

BaseCard.eventPrefix = 'card';

module.exports = BaseCard;
