const HitCard = require('./hit');
const HealCard = require('./heal');

class SurvivalKnifeCard extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🗡',
		...rest
	} = {}) {
		super({ icon, ...rest });

		this.healCard = new HealCard({ healthDice: '2d4' });
	}

	get stats () {
		return `Either ${super.stats} or
Heal 2d4 if below a quarter health`;
	}

	effect (player, target, ring, activeContestants) {
		if (player.hp < (player.bloodiedValue / 2)) {
			return this.healCard.effect(player, target, ring);
		}

		return super.effect(player, target, ring, activeContestants);
	}
}

SurvivalKnifeCard.cardType = 'Survival Knife';
SurvivalKnifeCard.probability = 30;
SurvivalKnifeCard.description = 'If times get too rough, stab yourself in the thigh and press the pommel for a Stimpak injection.';
SurvivalKnifeCard.level = 1;
SurvivalKnifeCard.defaults = {
	...HitCard.defaults,
	damageDice: '2d4'
};

module.exports = SurvivalKnifeCard;
