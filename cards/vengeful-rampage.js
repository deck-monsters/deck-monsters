const HitCard = require('./hit');
const { BARBARIAN } = require('../helpers/classes');

class VenegefulRampageCard extends HitCard {
	get stats () {
		return `Hit: ${this.attackDice} vs AC
Damage: ${this.damageDice} +1 per wound suffered`;
	}

	getDamageRoll (player) {
		const damageModifier = Math.min(player.maxHp - player.hp, player.damageModifier * 2);
		return super.getDamageRoll({ damageModifier, bonusDamageDice: player.bonusDamageDice });
	}
}

VenegefulRampageCard.cardType = 'Vengeful Rampage';
VenegefulRampageCard.probability = 20;
VenegefulRampageCard.description = 'Your wounds only make you stronger.';
VenegefulRampageCard.level = 3;
VenegefulRampageCard.permittedClassesAndTypes = [BARBARIAN];

VenegefulRampageCard.flavors = {
	hits: [
		['fights back against', 80],
		['screams with rage against', 70],
		['eviscerates', 70],
		['curses the very existance of', 50],
		['glows red with rage and annihilates', 5]
	]
};

module.exports = VenegefulRampageCard;
