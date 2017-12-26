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

	effect (faceswapPlayer, originalTarget) { // eslint-disable-line no-unused-vars
		return new Promise((resolve) => {
			const faceswapEffect = ({
				card,
				phase,
				player: faceswapTarget
			}) => {
				if (phase === DEFENSE_PHASE) {
					const { effect } = card;

					// The card that is passed in should be a clone already so we're going to edit it directly
					if (effect) {
						card.effect = (swappedPlayer, swappedTarget, ring, activeContestants) => {
							if (swappedTarget === faceswapPlayer) {
								faceswapPlayer.encounterEffects = faceswapPlayer.encounterEffects.filter(encounterEffect => encounterEffect !== faceswapEffect);

								this.emit('effect', {
									effectResult: `${this.icon} faceswapped`,
									player: faceswapPlayer,
									target: faceswapTarget,
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

			faceswapPlayer.encounterEffects = [...faceswapPlayer.encounterEffects, faceswapEffect];

			this.emit('narration', {
				narration:
`${faceswapPlayer.identity} prepares to ${this.icon} faceswap the next player who targets them.`
			});

			resolve(true);
		});
	}
}

EnchantedFaceswapCard.cardType = 'Enchanted Faceswap';
EnchantedFaceswapCard.probability = 50;
EnchantedFaceswapCard.description = 'A snapchat filter for the magically inclined. This spell will cause the next card played with the caster as the target to be reversed so that the player of the card becomes the target.';
EnchantedFaceswapCard.cost = 4;
EnchantedFaceswapCard.level = 1;
EnchantedFaceswapCard.permittedClassesAndTypes = [CLERIC];

module.exports = EnchantedFaceswapCard;
