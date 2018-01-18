/* eslint-disable max-len */

const BaseCard = require('./base');

const { BARD, CLERIC } = require('../helpers/classes');
const { DEFENSE_PHASE } = require('../helpers/phases');

const EFFECT_TYPE = 'FaceswapEffect';

const isFaceswapping = monster => !!monster.encounterEffects.find(encounterEffect => encounterEffect.effectType === EFFECT_TYPE);

class EnchantedFaceswapCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '👥'
	} = {}) {
		super({ icon });
	}

	getTargets (player) { // eslint-disable-line class-methods-use-this
		return [player];
	}

	effect (faceswapPlayer, faceswapTarget) {
		const faceswapEffect = ({
			card,
			phase
		}) => {
			if (phase === DEFENSE_PHASE) {
				const { effect, isAreaOfEffect } = card;

				// The card that is passed in should be a clone already so we're going to edit it directly
				if (effect && !isAreaOfEffect) {
					card.effect = (swappedPlayer, swappedTarget, ring, activeContestants) => {
						if (swappedTarget === faceswapTarget) {
							faceswapTarget.encounterEffects = faceswapTarget.encounterEffects.filter(encounterEffect => encounterEffect.effectType !== EFFECT_TYPE);

							this.emit('effect', {
								effectResult: `${this.icon} faceswapped by`,
								player: faceswapTarget,
								target: swappedPlayer,
								ring
							});

							return effect.call(card, swappedTarget, swappedPlayer, ring, activeContestants);
						}

						return effect.call(card, swappedPlayer, swappedTarget, ring, activeContestants);
					};
				}
			}

			return card;
		};

		faceswapEffect.effectType = EFFECT_TYPE;

		const alreadyFaceswapping = isFaceswapping(faceswapTarget);

		if (!alreadyFaceswapping) {
			faceswapTarget.encounterEffects = [...faceswapTarget.encounterEffects, faceswapEffect];

			this.emit('narration', {
				narration: `${faceswapTarget.identity} prepares to ${this.icon} faceswap the next player who targets ${faceswapTarget.pronouns.him}.`
			});
		} else {
			this.emit('narration', {
				narration: `${faceswapTarget.identity} already has ${faceswapTarget.pronouns.his} phone out.`
			});
		}

		return true;
	}
}

EnchantedFaceswapCard.cardType = 'Enchanted Faceswap';
EnchantedFaceswapCard.permittedClassesAndTypes = [BARD, CLERIC];
EnchantedFaceswapCard.probability = 40;
EnchantedFaceswapCard.description = 'A snapchat filter for the magically inclined. This spell will cause the next card played with the caster as the target to be reversed so that the player of the card becomes the target.';
EnchantedFaceswapCard.level = 1;
EnchantedFaceswapCard.cost = 55;

module.exports = EnchantedFaceswapCard;
