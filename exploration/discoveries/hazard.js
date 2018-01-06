/* eslint-disable max-len */

const BaseCard = require('./base');
const { roll } = require('../../helpers/chance');
const { getFlavor } = require('../../helpers/flavor');

// ${assailant.icon} ${icon} ${monster.icon}  ${assailant.givenName} ${getFlavor('hits', flavors)} ${monster.givenName} for ${damage} damage.


class HazardCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		damageDice,
		icon = '⚠️',
		icons,
		flavorTemplate
	} = {}) {
		super({ damageDice, icon, icons, flavorTemplate });
	}

	get damageDice () {
		return this.options.damageDice;
	}

	set damageDice (damageDice) {
		this.setOptions({
			damageDice
		});
	}

	get stats () {
		return this.flavor;
	}

	getDamageFlavors(player, number) {
		const damageFlavors = [
			[
				['is caught in a sudden thunderstorm, and pummeled with hail for', 100, '⛈']
			],
			[
				['is caught in a sudden windstorm, hit by debris and branches, and takes', 100, '🌬']
			],
			[
				['falls into a hole and takes', 100, '🕳']
			],
			[
				[`is burnt by ${player.pronouns[1]} camp fire for`, 50, '🔥']
				['is caught in a sudden forest fire and takes', 50, '🔥']
			]
		]

		return damageFlavors[number];
	}

	effect (player) {
		const damage = roll({ primaryDice: this.damageDice }).result;

		this.flavors = this.getDamageFlavors(player, damage - 1);

		this.flavor = getFlavor('hits', flavors);
		this.flavorText = `${this.flavor[2]} ${player.icon}  ${player.givenName} ${this.flavor[0]} ${damage} damage.`

		player.hit(damage, this);

		return player;
	}
}

HazardCard.cardType = 'Hazard';
HazardCard.probability = 10;
HazardCard.description = 'It is dangerous out there. Your monster...';
HazardCard.defaults = {
	damageDice: '1d4'
};



module.exports = HazardCard;
