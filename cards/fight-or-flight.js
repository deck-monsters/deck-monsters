const HitCard = require('./hit');

const FleeCard = require('./flee');

class FightOrFlightCard extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '😖',
		...rest
	} = {}) {
		super({ icon, ...rest });
		this.fleeEffect = new FleeCard().effect;
	}

	get stats () {
		return `${super.stats}
Chance to flee if below a quarter health`;
	}

	getTargets (player, proposedTarget) { // eslint-disable-line class-methods-use-this, no-unused-vars
		if (player.hp < (player.bloodiedValue / 2)) {
			return [player];
		}

		return [proposedTarget];
	}

	effect (player, target, ring, activeContestants) {
		if (player === target) {
			return this.fleeEffect(player, target, ring, activeContestants);
		}

		return super.effect(player, target, ring, activeContestants);
	}
}

FightOrFlightCard.cardType = 'Fight or Flight';
FightOrFlightCard.probability = 60;
FightOrFlightCard.description = 'Survival instincts are nothing to be ashamed of.';
FightOrFlightCard.cost = 10;
FightOrFlightCard.noBosses = true;

module.exports = FightOrFlightCard;
