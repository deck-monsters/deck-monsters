/* eslint-disable max-len */

const BaseCard = require('./base');
const { CLERIC } = require('../helpers/classes');

class BlastCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		damage = 3,
		icon = '💥',
		levelDamage = 1
	} = {}) {
		super({ damage, icon, levelDamage });
	}

	get damage () {
		return this.options.damage;
	}

	get levelDamage () {
		return this.options.levelDamage;
	}

	get stats () {
		return `Blast: ${this.damage} base damage + ${this.levelDamage} per level of the caster`;
	}

	effect (player, target, ring) { // eslint-disable-line no-unused-vars
		const damage = this.damage + (this.levelDamage * player.level);

		return new Promise((resolve) => {
			resolve(Promise.all(ring.contestants.map(({ monster }) => {
				if (monster !== player) {
					return monster.hit(damage, player, this);
				}

				return Promise.resolve();
			})));
		});
	}
}

BlastCard.cardType = 'Blast';
BlastCard.probability = 30;
BlastCard.description = 'A magical blast against every opponent in the encounter.';
BlastCard.cost = 4;
BlastCard.level = 0;
BlastCard.permittedClasses = [CLERIC];

module.exports = BlastCard;
