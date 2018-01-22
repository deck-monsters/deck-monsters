const HitCard = require('./hit');

const { BARBARIAN } = require('../helpers/classes');
const { RARE } = require('../helpers/probabilities');
const { PRICEY } = require('../helpers/costs');

class VenegefulRampageCard extends HitCard {
	get stats () {
		return `Hit: ${this.attackDice} vs AC
Damage: ${this.damageDice} +1 per wound suffered`;
	}

	getDamageRoll (player) {
		const strModifier = Math.min(player.maxHp - player.hp, Math.max(player.strModifier * 2, 10));
		return super.getDamageRoll({ strModifier, bonusDamageDice: player.bonusDamageDice });
	}
}

VenegefulRampageCard.cardType = 'Vengeful Rampage';
VenegefulRampageCard.permittedClassesAndTypes = [BARBARIAN];
VenegefulRampageCard.probability = RARE.probability;
VenegefulRampageCard.description = 'Your wounds only make you stronger.';
VenegefulRampageCard.level = 3;
VenegefulRampageCard.cost = PRICEY.cost;
VenegefulRampageCard.notForSale = true;

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
