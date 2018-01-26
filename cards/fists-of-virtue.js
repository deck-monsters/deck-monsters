const HitCard = require('./hit');

const { COMMON } = require('../helpers/probabilities');
const { CHEAP } = require('../helpers/costs');

class FistsOfVirtueCard extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🙏',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}

	get stats () {
		return `${super.stats}
Strikes opponent with highest current hp.`;
	}

	getTargets (player, proposedTarget, ring, activeContestants) { // eslint-disable-line class-methods-use-this
		return [activeContestants.reduce((potentialTarget, { monster }) => {
			if (monster !== player && monster.hp > potentialTarget.hp) {
				return monster;
			}

			return potentialTarget;
		}, proposedTarget)];
	}
}

FistsOfVirtueCard.cardType = 'Fists of Virtue';
FistsOfVirtueCard.probability = COMMON.probability;
FistsOfVirtueCard.description = 'You strike at the biggest bully in the room.';
FistsOfVirtueCard.level = 1;
FistsOfVirtueCard.cost = CHEAP.cost;

FistsOfVirtueCard.defaults = {
	...HitCard.defaults,
	damageDice: '1d8' // Slightly more possible damage
};

module.exports = FistsOfVirtueCard;
