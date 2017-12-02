const HitCard = require('./hit');
const { BARBARIAN } = require('../helpers/classes');

class VenegefulRampageCard extends HitCard {
	get stats () {
		return `Hit: ${this.attackDice} vs AC
Damage: ${this.damageDice} +1 per wound suffered`;
	}

	getDamageRoll (player) {
		return super.getDamageRoll({ damageModifier: player.DEFAULT_HP - player.hp, bonusDamageDice: player.bonusDamageDice });
	}
}

VenegefulRampageCard.cardType = 'Venegeful Rampage';
VenegefulRampageCard.probability = 10;
VenegefulRampageCard.description = 'Your wounds only make you stronger.';
VenegefulRampageCard.level = 3;
VenegefulRampageCard.permittedClasses = [BARBARIAN];

module.exports = VenegefulRampageCard;
