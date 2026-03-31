import { BaseCard, type CardOptions } from './base.js';
import { chance } from '../helpers/chance.js';
import { sample } from '../helpers/random.js';
import { AOE, HIDE, ACOUSTIC, PSYCHIC } from '../constants/card-classes.js';
import { ATTACK_PHASE, DEFENSE_PHASE } from '../constants/phases.js';
import { BARD, CLERIC, WIZARD } from '../constants/creature-classes.js';
import { capitalize } from '../helpers/capitalize.js';
import { INVISIBILITY_EFFECT } from '../constants/effect-types.js';
import { PRICEY } from '../helpers/costs.js';
import { RARE } from '../helpers/probabilities.js';
import { isInvisible } from '../helpers/is-invisible.js';

const { roll } = chance;

export class CloakOfInvisibilityCard extends BaseCard {
	static cardClass = [HIDE];
	static cardType = 'Cloak of Invisibility';
	static permittedClassesAndTypes = [BARD, CLERIC, WIZARD];
	static probability = RARE.probability;
	static description = 'You don your cloak and disappear, if only for a while.';
	static level = 1;
	static cost = PRICEY.cost;
	static notForSale = true;

	constructor({ icon = '☁️' }: Partial<CardOptions> = {}) {
		super({ icon } as Partial<CardOptions>);
	}

	get stats(): string {
		return `You are invisible until you play a card that targets another player, or for the next 2 cards you play (whichever comes first).\n1d20 vs your int for opponent to see you on their turn (natural 20 removes your cloak).`;
	}

	override getTargets(player: any): any[] {
		return [player];
	}

	getSavingThrow(player: any): any {
		return roll({
			primaryDice: '1d20',
			modifier: player.intModifier,
			crit: true,
		});
	}

	effect(invisibilityPlayer: any, invisibilityTarget: any): any {
		invisibilityTarget.encounterModifiers.invisibilityTurns = 0;

		const invisibilityEffect = ({
			card,
			phase,
			player: effectPlayer,
		}: any) => {
			const { effect } = card;

			if (phase === ATTACK_PHASE && effectPlayer === invisibilityTarget) {
				invisibilityTarget.encounterModifiers.invisibilityTurns += 1;
			}

			if (effect) {
				card.effect = (
					player: any,
					target: any,
					ring: any,
					activeContestants: any
				) => {
					if (
						phase === DEFENSE_PHASE &&
						player !== invisibilityTarget &&
						target === invisibilityTarget &&
						!card.isCardClass(AOE) &&
						!card.isCardClass(ACOUSTIC)
					) {
						if (!card.isCardClass(PSYCHIC)) {
							const potentialTargets = activeContestants.filter(
								({ monster }: any) =>
									monster !== player && !isInvisible(monster)
							);

							if (potentialTargets.length > 0) {
								const newTarget = (sample(potentialTargets) as any).monster;
								this.emit('narration', {
									narration: `${player.givenName} doesn't see ${invisibilityTarget.givenName} anywhere and turns ${player.pronouns.his} attention to ${newTarget.givenName} instead.`,
								});
								return effect.call(
									card,
									player,
									newTarget,
									ring,
									activeContestants
								);
							}
						}

						this.emit('effect', {
							effectResult: `${this.icon} hidden from`,
							player,
							target: invisibilityTarget,
							ring,
						});

						const savingThrow = this.getSavingThrow(player);
						const { success, strokeOfLuck, curseOfLoki, tie } =
							this.checkSuccess(savingThrow, invisibilityTarget.int);
						let outcome: string;

						if (strokeOfLuck) {
							invisibilityTarget.encounterEffects =
								invisibilityTarget.encounterEffects.filter(
									(encounterEffect: any) =>
										encounterEffect.effectType !== INVISIBILITY_EFFECT
								);
							outcome = `${player.givenName} rolled a natural 20. ${capitalize(player.pronouns.he)} immediately realizes exactly where ${invisibilityTarget.givenName} is and strips off ${invisibilityTarget.pronouns.his} ${this.cardType.toLowerCase()}.`;
						} else if (curseOfLoki) {
							outcome = `${player.givenName} rolled a 1. While stumbling about looking for ${invisibilityTarget.givenName} ${player.pronouns.he} trips and hits ${player.pronouns.him}self instead.`;
						} else if (tie) {
							outcome = `${player.givenName} almost catches a glimpse of ${invisibilityTarget.givenName} but when ${player.pronouns.he} blinks ${invisibilityTarget.givenName} is gone.`;
						} else if (success) {
							outcome = `Success. ${player.givenName} catches a glimpse of ${invisibilityTarget.givenName} and attacks.`;
						} else {
							outcome = `Fail. ${invisibilityTarget.givenName} remains ${this.icon} hidden from ${player.givenName}.`;
						}

						this.emit('rolled', {
							reason: `vs ${invisibilityTarget.givenName}'s int (${target.int}) to determine if ${player.pronouns.he} can find ${invisibilityTarget.pronouns.him}.`,
							card,
							roll: savingThrow,
							who: player,
							outcome,
							vs: target.int,
						});

						if (curseOfLoki) {
							return effect.call(card, player, player, ring, activeContestants);
						} else if (!success) {
							return true;
						}
					} else if (
						phase === ATTACK_PHASE &&
						player === invisibilityTarget
					) {
						if (
							target !== invisibilityTarget ||
							invisibilityTarget.encounterModifiers.invisibilityTurns > 2
						) {
							invisibilityTarget.encounterEffects =
								invisibilityTarget.encounterEffects.filter(
									(encounterEffect: any) =>
										encounterEffect.effectType !== INVISIBILITY_EFFECT
								);

							if (!card.invisibilityNarrationEmitted) {
								this.emit('narration', {
									narration: `${invisibilityTarget.identity} slips off ${invisibilityTarget.pronouns.his} ${this.cardType.toLowerCase()}.`,
								});
								card.invisibilityNarrationEmitted = true;
							}
						}
					}

					return effect.call(card, player, target, ring, activeContestants);
				};
			}

			return card;
		};

		invisibilityEffect.effectType = INVISIBILITY_EFFECT;

		const alreadyInvisible = isInvisible(invisibilityTarget);

		if (!alreadyInvisible) {
			invisibilityTarget.encounterEffects = [
				...invisibilityTarget.encounterEffects,
				invisibilityEffect,
			];
			this.emit('narration', {
				narration: `${invisibilityTarget.identity} dons ${invisibilityTarget.pronouns.his} ${this.cardType.toLowerCase()}.`,
			});
		} else {
			this.emit('narration', {
				narration: `${invisibilityTarget.identity} takes a moment to improve ${invisibilityTarget.pronouns.his} concealment.`,
			});
		}

		return true;
	}
}

export default CloakOfInvisibilityCard;
