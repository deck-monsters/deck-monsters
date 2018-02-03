/* eslint-disable max-len */

const { UNCOMMON } = require('../helpers/probabilities');
const { REASONABLE } = require('../helpers/costs');

const HitCard = require('./hit');

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

	getTargets (player) { // eslint-disable-line class-methods-use-this
		return [player];
	}

	effect (delayingPlayer, delayingTarget, ring) { // eslint-disable-line no-unused-vars
		let whenPlayed = Date.now();
		const him = (delayingPlayer !== delayingTarget) ? delayingTarget.givenName : delayingPlayer.pronouns.him;
		const his = (delayingPlayer !== delayingTarget) ? `${delayingTarget.givenName}'s` : delayingPlayer.pronouns.his;

		const delayedHitEffect = ({
			card
		}) => {
			const { play } = card;

			if (play) {
				card.play = (...args) => play.call(card, ...args).then((result) => {
					if (!delayingTarget.encounterModifiers.timeShifted === true) {
						const lastHitByOther = delayingTarget.encounterModifiers.hitLog && delayingTarget.encounterModifiers.hitLog.find(hitter => hitter.assailant !== delayingTarget);
						if (lastHitByOther && lastHitByOther.when > whenPlayed) {
							whenPlayed = lastHitByOther.when;
							ring.encounterEffects = ring.encounterEffects.filter(encounterEffect => encounterEffect !== delayedHitEffect);

							if (delayingTarget.dead) {
								this.emit('narration', {
									narration: `
${this.icon} With ${his} dying breath, ${delayingPlayer.givenName} avenges the blow ${lastHitByOther.assailant.givenName} gave ${him}.`
								});
							} else {
								this.emit('narration', {
									narration: `
${this.icon} ${delayingPlayer.givenName} immediately responds to the blow ${lastHitByOther.assailant.givenName} gave ${him}.`
								});
							}

							return Promise.resolve(super.effect(delayingPlayer, lastHitByOther.assailant, ring))
								.then(() =>
									// This does not affect the current player or turn in any way, it is a response
									// to the previous player/turn, so just return the current card's result
									result);
						}
					}

					return result;
				});
			}

			return card;
		};

		this.emit('narration', {
			narration: `${delayingPlayer.givenName} spreads ${delayingPlayer.pronouns.his} focus across the battlefield, waiting for ${his} enemy to reveal themselves.`
		});

		ring.encounterEffects = [...ring.encounterEffects, delayedHitEffect];
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
