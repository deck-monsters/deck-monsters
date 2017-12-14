const HitCard = require('./hit');
const { BARBARIAN } = require('../helpers/classes');

class VenegefulRampageCard extends HitCard {
	get stats () {
		return `Hit: ${this.attackDice} vs AC
Damage: ${this.damageDice} +1 per wound suffered`;
	}

	getDamageRoll (player) {
		return super.getDamageRoll({ damageModifier: player.maxHp - player.hp, bonusDamageDice: player.bonusDamageDice });
	}
}

VenegefulRampageCard.cardType = 'Vengeful Rampage';
VenegefulRampageCard.probability = 10;
VenegefulRampageCard.description = 'Your wounds only make you stronger.';
VenegefulRampageCard.level = 3;
VenegefulRampageCard.permittedClasses = [BARBARIAN];

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
