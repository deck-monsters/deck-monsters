/* eslint-disable max-len */
const Promise = require('bluebird');

const BaseCard = require('./base');

const { IMPOSSIBLE } = require('../helpers/probabilities');

class DestroyCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		damage,
		icon = '☠️',
		levelDamage
	} = {}) {
		super({ damage, icon, levelDamage });
	}

	get damage () {
		return this.options.damage;
	}

	get levelDamage () {
		return this.options.levelDamage;
	}

	get stats () { // eslint-disable-line class-methods-use-this
		return 'Destroy: Annihilates your opponent';
	}

	effect (player, target, ring, activeContestants) {
		const damage = this.damage + (this.levelDamage * player.level);

		return Promise.map(activeContestants, ({ monster }) => {
			if (monster !== player) {
				return monster.hit(damage, player, this);
			}

			return Promise.resolve();
		})
			.then(() => !target.dead);
	}
}

DestroyCard.cardType = 'Destroy';
DestroyCard.probability = IMPOSSIBLE.probability;
DestroyCard.description = 'A test card used to completely destroy your opponent.';
DestroyCard.level = 0;
DestroyCard.cost = 9999999999999;
DestroyCard.notForSale = true;

DestroyCard.defaults = {
	damage: 9999999999999,
	levelDamage: 1
};

DestroyCard.flavors = {
	hits: [
		['annihilates', 100]
	]
};

module.exports = DestroyCard;
