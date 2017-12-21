const HitCard = require('./hit');

class FistsOfVillainyCard extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🐀',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}

	effect (player, oldTarget, ring, activeContestants) {
		const target = activeContestants.reduce((potentialTarget, { monster }) => {
			if (monster !== player && monster.hp < potentialTarget.hp) {
				return monster;
			}

			return potentialTarget;
		}, oldTarget);

		return super.effect(player, target, ring, activeContestants);
	}
}

FistsOfVillainyCard.cardType = 'Fists of Villainy';
FistsOfVillainyCard.probability = 30;
FistsOfVillainyCard.description = 'You show no mercy to the weak.';
FistsOfVillainyCard.level = 1;

module.exports = FistsOfVillainyCard;
