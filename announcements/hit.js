
const BaseAnnounce = require('./announce');

const { actionCard } = require('../helpers/card');
const { max } = require('../helpers/chance');

class AnnounceHit extends BaseAnnounce {
	constructor ({
		channel
	} = {}) {
		super({ channel });
	}

	announce (className, monster, {
		assailant,
		card,
		damage,
		prevHp
	}) {
		console.log('');
		console.log('');
		console.log('');
		console.log('');
		console.log('asdfasdfadsfadsfasdfasdfasdfasdafsdasfasdf');
		console.log('');
		console.log('');
		console.log('');
		console.log('');
		console.log('announce it!', this.channel, damage)
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

		this.channel({
			announce:
	`${assailant.icon} ${icon} ${monster.icon}  ${assailant.givenName} ${this.getFlaver('hits', flavors)} ${monster.givenName} for ${damage} damage.

	${monster.icon}  *${bloodied}${monster.givenName} has ${only}${monster.hp}HP.*
	`
		});
	};
}

module.exports = AnnounceHit;
