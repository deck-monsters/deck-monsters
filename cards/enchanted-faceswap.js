/* eslint-disable max-len */

const BaseCard = require('./base');

const { AOE, HIDE, PSYCHIC } = require('../constants/card-classes');
const { BARD, CLERIC } = require('../constants/creature-classes');
const { DEFENSE_PHASE } = require('../constants/phases');
const { FACESWAP_EFFECT } = require('../constants/effect-types');
const { PRICEY } = require('../helpers/costs');
const { RARE } = require('../helpers/probabilities');

const isFaceswapping = monster => !!monster.encounterEffects.find(encounterEffect => encounterEffect.effectType === FACESWAP_EFFECT);

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
				const { effect } = card;

				// The card that is passed in should be a clone already so we're going to edit it directly
				if (effect && !card.isCardClass(AOE) && !card.isCardClass(PSYCHIC)) {
					card.effect = (swappedPlayer, swappedTarget, ring, activeContestants) => {
						if (swappedTarget === faceswapTarget) {
							faceswapTarget.encounterEffects = faceswapTarget.encounterEffects.filter(encounterEffect => encounterEffect.effectType !== FACESWAP_EFFECT);

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

		faceswapEffect.effectType = FACESWAP_EFFECT;

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

EnchantedFaceswapCard.cardClass = [HIDE];
EnchantedFaceswapCard.cardType = 'Enchanted Faceswap';
EnchantedFaceswapCard.permittedClassesAndTypes = [BARD, CLERIC];
EnchantedFaceswapCard.probability = RARE.probability;
EnchantedFaceswapCard.description = 'A snapchat filter for the magically inclined. This spell will cause the next card played with the caster as the target to be reversed so that the player of the card becomes the target.';
EnchantedFaceswapCard.level = 1;
EnchantedFaceswapCard.cost = PRICEY.cost;
EnchantedFaceswapCard.notForSale = true;

module.exports = EnchantedFaceswapCard;
