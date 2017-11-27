/* eslint-disable max-len */

const BaseCard = require('./base');
const { CLERIC } = require('../helpers/classes');
const { DEFENSE_PHASE } = require('../helpers/phases');

class EnchantedFaceswapCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '👥'
	} = {}) {
		super({ icon });
	}

	effect (faceswapPlayer, faceswapTarget, ring) { // eslint-disable-line no-unused-vars
		return new Promise((resolve) => {
			const faceswapEffect = ({
				card,
				phase
			}) => {
				if (phase === DEFENSE_PHASE) {
					const { play } = card;

					// The card that is passed in should be a clone already so we're going to edit it directly
					card.play = (swappedPlayer, swappedTarget) => play.call(card, swappedTarget, swappedPlayer, ring);
					faceswapPlayer.encounterEffects = faceswapPlayer.encounterEffects.filter(effect => effect !== faceswapEffect);

					this.emit('effect', {
						effectName: `a faceswap ${this.icon} effect`,
						player: faceswapPlayer,
						target: faceswapTarget,
						ring
					});
				}

				return card;
			};

			faceswapPlayer.encounterEffects = [...faceswapPlayer.encounterEffects, faceswapEffect];

			resolve(true);
		});
	}
}

EnchantedFaceswapCard.cardType = 'Enchanted Faceswap';
EnchantedFaceswapCard.probability = 20;
EnchantedFaceswapCard.description = 'A snapchat filter for the magically inclined. This spell will cause the next card played with the caster as the target to be reversed so that the player of the card becomes the target.';
EnchantedFaceswapCard.cost = 4;
EnchantedFaceswapCard.level = 1;
EnchantedFaceswapCard.permittedClasses = [CLERIC];

module.exports = EnchantedFaceswapCard;
