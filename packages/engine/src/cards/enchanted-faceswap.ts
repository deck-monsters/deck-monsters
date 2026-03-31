import { BaseCard, type CardOptions } from './base.js';
import { AOE, HIDE, PSYCHIC } from '../constants/card-classes.js';
import { BARD, CLERIC } from '../constants/creature-classes.js';
import { DEFENSE_PHASE } from '../constants/phases.js';
import { FACESWAP_EFFECT } from '../constants/effect-types.js';
import { PRICEY } from '../helpers/costs.js';
import { RARE } from '../helpers/probabilities.js';

const isFaceswapping = (monster: any): boolean =>
	!!monster.encounterEffects.find(
		(encounterEffect: any) => encounterEffect.effectType === FACESWAP_EFFECT
	);

export class EnchantedFaceswapCard extends BaseCard {
	static cardClass = [HIDE];
	static cardType = 'Enchanted Faceswap';
	static permittedClassesAndTypes = [BARD, CLERIC];
	static probability = RARE.probability;
	static description =
		'A snapchat filter for the magically inclined. This spell will cause the next card played with the caster as the target to be reversed so that the player of the card becomes the target.';
	static level = 1;
	static cost = PRICEY.cost;
	static notForSale = true;

	constructor({ icon = '👥' }: Partial<CardOptions> = {}) {
		super({ icon } as Partial<CardOptions>);
	}

	override getTargets(player: any): any[] {
		return [player];
	}

	effect(faceswapPlayer: any, faceswapTarget: any): any {
		const faceswapEffect = ({ card, phase }: any) => {
			if (phase === DEFENSE_PHASE) {
				const { effect } = card;
				if (
					effect &&
					!card.isCardClass(AOE) &&
					!card.isCardClass(PSYCHIC)
				) {
					card.effect = (
						swappedPlayer: any,
						swappedTarget: any,
						ring: any,
						activeContestants: any
					) => {
						if (swappedTarget === faceswapTarget) {
							faceswapTarget.encounterEffects =
								faceswapTarget.encounterEffects.filter(
									(encounterEffect: any) =>
										encounterEffect.effectType !== FACESWAP_EFFECT
								);

							this.emit('effect', {
								effectResult: `${this.icon} faceswapped by`,
								player: faceswapTarget,
								target: swappedPlayer,
								ring,
							});

							return effect.call(
								card,
								swappedTarget,
								swappedPlayer,
								ring,
								activeContestants
							);
						}

						return effect.call(
							card,
							swappedPlayer,
							swappedTarget,
							ring,
							activeContestants
						);
					};
				}
			}

			return card;
		};

		faceswapEffect.effectType = FACESWAP_EFFECT;

		const alreadyFaceswapping = isFaceswapping(faceswapTarget);

		if (!alreadyFaceswapping) {
			faceswapTarget.encounterEffects = [
				...faceswapTarget.encounterEffects,
				faceswapEffect,
			];
			this.emit('narration', {
				narration: `${faceswapTarget.identity} prepares to ${this.icon} faceswap the next player who targets ${faceswapTarget.pronouns.him}.`,
			});
		} else {
			this.emit('narration', {
				narration: `${faceswapTarget.identity} already has ${faceswapTarget.pronouns.his} phone out.`,
			});
		}

		return true;
	}
}

export default EnchantedFaceswapCard;
