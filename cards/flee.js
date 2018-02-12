const BaseCard = require('./base');

const { roll } = require('../helpers/chance');

const { UNCOMMON } = require('../helpers/probabilities');
const { ALMOST_NOTHING } = require('../helpers/costs');
const { HIDE } = require('../constants/card-classes');

class FleeCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🏃'
	} = {}) {
		super({ icon });
	}

	get stats () { // eslint-disable-line class-methods-use-this
		return 'Chance to run away if bloodied (hp < half)';
	}

	getTargets (player) { // eslint-disable-line class-methods-use-this, no-unused-vars
		return [player];
	}

	effect (player, target, ring, activeContestants) { // eslint-disable-line no-unused-vars
		if (target.bloodied) {
			const fleeRoll = roll({ primaryDice: '1d20', modifier: target.dexModifier, crit: true });
			const { success } = this.checkSuccess(fleeRoll, 10);

			this.emit('rolled', {
				reason: 'and needs 10 or higher to flee.',
				card: this,
				roll: fleeRoll,
				who: target,
				outcome: success ? 'Success!' : 'Fail!'
			});

			return ring.channelManager.sendMessages()
				.then(() => {
					if (success) {
						return target.leaveCombat(activeContestants);
					}

					this.emit('stay', {
						fleeResult: fleeRoll.result,
						fleeRoll,
						player: target,
						activeContestants
					});

					return true;
				});
		}

		this.emit('stay', {
			player: target,
			activeContestants
		});

		return true;
	}
}

FleeCard.cardClass = [HIDE];
FleeCard.cardType = 'Flee';
FleeCard.probability = UNCOMMON.probability;
FleeCard.description = 'There is no shame in living to fight another day.';
FleeCard.cost = ALMOST_NOTHING.cost;
FleeCard.noBosses = true;

module.exports = FleeCard;
