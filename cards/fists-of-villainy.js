const HitCard = require('./hit');

const { UNCOMMON } = require('../helpers/probabilities');
const { VERY_CHEAP } = require('../helpers/costs');
const { TARGET_LOWEST_HP_PLAYER, getTarget } = require('../helpers/targeting-strategies');

class FistsOfVillainyCard extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🐀',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}

	get stats () {
		return `${super.stats}
Strikes opponent with lowest current hp.`;
	}

	getTargets (player, proposedTarget, ring, activeContestants) { // eslint-disable-line class-methods-use-this
		return [getTarget({
			contestants: activeContestants,
			playerMonster: player,
			strategy: TARGET_LOWEST_HP_PLAYER
		}).monster];
	}
}

FistsOfVillainyCard.cardType = 'Fists of Villainy';
FistsOfVillainyCard.probability = UNCOMMON.probability;
FistsOfVillainyCard.description = 'You show no mercy to the weak.';
FistsOfVillainyCard.level = 1;
FistsOfVillainyCard.cost = VERY_CHEAP.cost;

module.exports = FistsOfVillainyCard;
