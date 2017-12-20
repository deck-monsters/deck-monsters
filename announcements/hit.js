
const { getFlavor } = require('../helpers/flavor');
const BaseAnnounce = require('./announce.js');

class AnnounceHit extends BaseAnnounce {
	announce (className, monster, {
		assailant,
		card,
		damage,
		prevHp
	}) {
		const flavors = card && card.flavors;

		let icon = '🤜';
		if (damage >= 10) {
			icon = '🔥';
		} else if (damage >= 5) {
			icon = '🔪';
		} else if (damage === 1) {
			icon = '🏓';
		}

		const bloodied = (monster.bloodied && prevHp > monster.bloodiedValue) ? `${monster.givenName} is now bloodied. ` : '';
		const only = (monster.bloodied && monster.hp > 0) ? 'only ' : '';

		this.publicChannel({
			announce:
	`${assailant.icon} ${icon} ${monster.icon}  ${assailant.givenName} ${getFlavor('hits', flavors)} ${monster.givenName} for ${damage} damage.

	${monster.icon}  *${bloodied}${monster.givenName} has ${only}${monster.hp}HP.*
	`
		});
	}
}

module.exports = AnnounceHit;
