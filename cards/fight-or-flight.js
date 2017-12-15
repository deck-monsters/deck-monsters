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

	effect (player, target, ring, activeContestants) {
		if (player.hp < (player.bloodiedValue / 2)) {
			return this.fleeEffect(player, target, ring, activeContestants);
		}

		return super.effect(player, target, ring, activeContestants);
	}
}

FightOrFlightCard.cardType = 'Fight or Flight';
FightOrFlightCard.probability = 60;
FightOrFlightCard.description = 'Survival instincts are nothing to be ashamed of.';

module.exports = FightOrFlightCard;
