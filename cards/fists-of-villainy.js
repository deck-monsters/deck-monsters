const HitCard = require('./hit');

const { UNCOMMON } = require('../helpers/probabilities');
const { VERY_CHEAP } = require('../helpers/costs');

class FistsOfVillainyCard extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🐀',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}

	getTargets (player, proposedTarget, ring, activeContestants) { // eslint-disable-line class-methods-use-this
		return [activeContestants.reduce((potentialTarget, { monster }) => {
			if (monster !== player && monster.hp < potentialTarget.hp) {
				return monster;
			}

			return potentialTarget;
		}, proposedTarget)];
	}
}

FistsOfVillainyCard.cardType = 'Fists of Villainy';
FistsOfVillainyCard.probability = UNCOMMON.probability;
FistsOfVillainyCard.description = 'You show no mercy to the weak.';
FistsOfVillainyCard.level = 1;
FistsOfVillainyCard.cost = VERY_CHEAP.cost;

module.exports = FistsOfVillainyCard;
