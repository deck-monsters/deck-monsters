/* eslint-disable max-len */

const BaseCard = require('./base');

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

		return new Promise((resolve) => {
			resolve(Promise.all(activeContestants.map(({ monster }) => {
				if (monster !== player) {
					return monster.hit(damage, player, this);
				}

				return Promise.resolve();
			}))
				.then(() => !target.dead));
		});
	}
}

DestroyCard.cardType = 'Destroy';
DestroyCard.probability = 0;
DestroyCard.description = 'A test card used to completely destroy your opponent.';
DestroyCard.cost = 4;
DestroyCard.level = 0;
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
