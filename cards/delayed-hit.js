/* eslint-disable max-len */

const HitCard = require('./hit');
const { roll, max } = require('../helpers/chance');
const { GLOBAL_PHASE } = require('../helpers/phases');

class DelayedHit extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		flavors,
		attackDice,
		damageDice,
		targetProp,
		icon = '👊'
	} = {}) {
		super({ flavors, targetProp, attackDice, damageDice, icon });
	}

	effect (delayingPlayer, target, ring) { // eslint-disable-line no-unused-vars
		const when = Date.now();

		const delayedHitEffect = ({
			phase,
			ring
		}) => {
			if (phase === GLOBAL_PHASE) {
				if (player.encounterModifiers.lastHitBy && player.encounterModifiers.lastHitBy.when > when) {
					super.effect(player, player.encounterModifiers.lastHitBy.assailant, ring);
				}
			}
		}

		delayedHitEffect.effectType = 'DelayedHitEffect';
		ring.encounterEffects = [...ring.encounterEffects, delayedHitEffect];
	}
}

DelayedHit.cardType = 'Delayed Hit';
DelayedHit.probability = 60;
DelayedHit.description = 'Delay your turn, and to attack the next player who hits you.';
DelayedHit.level = 0;
DelayedHit.cost = 10;

DelayedHit.defaults = {
	...HitCard.defaults
};

module.exports = DelayedHit;
