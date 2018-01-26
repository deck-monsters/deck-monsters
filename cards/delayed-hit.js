/* eslint-disable max-len */

const { UNCOMMON } = require('../helpers/probabilities');
const { REASONABLE } = require('../helpers/costs');

const HitCard = require('./hit');
const { DEFENSE_PHASE } = require('../helpers/phases');

class DelayedHit extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🤛',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}

	get stats () {
		return `Delay your turn. Use the delayed turn to immediately hit the next player who hits you.
${super.stats}`;
	}

	effect (delayingPlayer, target) { // eslint-disable-line no-unused-vars
		const when = Date.now();

		const delayedHitEffect = ({
			card,
			phase,
			ring
		}) => {
			if (phase === DEFENSE_PHASE) {
				const lastHitByOther = delayingPlayer.encounterModifiers.hitLog.find(hitter => hitter.assailant !== delayingPlayer);
				if (lastHitByOther.when > when) {
					delayingPlayer.encounterEffects = delayingPlayer.encounterEffects.filter(encounterEffect => encounterEffect !== delayedHitEffect);

					return super.effect(delayingPlayer, lastHitByOther.assailant, ring)
						.then(() =>
							// This does not affect the current player or turn in any way, it is a response
							// to the previous player/turn, so just return the current card so they
							// game can continue as normal
							card);
				}
			}

			return card;
		};

		delayingPlayer.encounterEffects = [...delayingPlayer.encounterEffects, delayedHitEffect];
	}
}

DelayedHit.cardType = 'Delayed Hit';
DelayedHit.probability = UNCOMMON;
DelayedHit.description = 'Patience. Patience is key. When your opponent reveals themselves, then you strike.';
DelayedHit.cost = REASONABLE.cost;

DelayedHit.defaults = {
	...HitCard.defaults
};

module.exports = DelayedHit;
