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

/**
 * Finding a hidden monster is a contest (owner, 2026-10-14): the finder rolls 1d20 + int
 * against 10 + the hider's hiding stat. It used to be the hider's raw stat (5 + its modifier),
 * which a finder at equal modifiers beat three times in four, so a hide rarely lasted; at 10 it
 * is about even. Int is how you hide by wit (Cloak, Mood Scales); the Camouflage Vest hides
 * by dex, since blending in is physical and its Fighters and Barbarians run low on int.
 */
export const HIDE_DIFFICULTY = 10;

export class CloakOfInvisibilityCard extends BaseCard {
	static cardClass = [HIDE];
	static cardType = 'Cloak of Invisibility';
	static permittedClassesAndTypes = [BARD, CLERIC, WIZARD];
	static probability = RARE.probability;
	static description = 'You don your cloak and disappear, if only for a while.';
	static level = 1;
	static cost = PRICEY.cost;
	static notForSale = true;
	/** The stat a hider's difficulty adds: `HIDE_DIFFICULTY` + this modifier. */
	static hideStat: 'int' | 'dex' = 'int';

	constructor({ icon = '☁️' }: Partial<CardOptions> = {}) {
		super({ icon } as Partial<CardOptions>);
	}

	get stats(): string {
		return `You are invisible until you play a card that targets another player, or for the next 2 cards you play (whichever comes first).\n${this.findRollText} for an opponent to see you on their turn (natural 20 removes your ${this.cardType.toLowerCase()}).`;
	}

	get hideStat(): 'int' | 'dex' {
		return (this.constructor as typeof CloakOfInvisibilityCard).hideStat;
	}

	/** "1d20 + their int vs 10 + your int": the card says both sides of the roll. */
	get findRollText(): string {
		return `1d20 + their int vs ${HIDE_DIFFICULTY} + your ${this.hideStat}`;
	}

	/** What a finder has to beat to see this hider. */
	hideDifficulty(hider: any): number {
		return HIDE_DIFFICULTY + (hider[`${this.hideStat}Modifier`] ?? 0);
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

	// The three lines a hiding card speaks. Mood Scales hides the same way and says it in
	// its own words.
	hideNarration(target: any): string {
		return `${target.identity} dons ${target.pronouns.his} ${this.cardType.toLowerCase()}.`;
	}

	concealNarration(target: any): string {
		return `${target.identity} takes a moment to improve ${target.pronouns.his} concealment.`;
	}

	revealNarration(target: any): string {
		return `${target.identity} slips off ${target.pronouns.his} ${this.cardType.toLowerCase()}.`;
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
						const hideDifficulty = this.hideDifficulty(invisibilityTarget);
						const { success, strokeOfLuck, curseOfLoki, tie } =
							this.checkSuccess(savingThrow, hideDifficulty);
						let outcome: string;

						if (strokeOfLuck) {
							invisibilityTarget.encounterEffects =
								invisibilityTarget.encounterEffects.filter(
									(encounterEffect: any) =>
										encounterEffect.effectType !== INVISIBILITY_EFFECT
								);
							outcome = `${player.givenName} rolled a natural 20. ${capitalize(player.pronouns.he)} immediately realize${player.pronouns.verbSuffix ?? 's'} exactly where ${invisibilityTarget.givenName} is and strips off ${invisibilityTarget.pronouns.his} ${this.cardType.toLowerCase()}.`;
						} else if (curseOfLoki) {
							outcome = `${player.givenName} rolled a 1. While stumbling about looking for ${invisibilityTarget.givenName} ${player.pronouns.he} trip${player.pronouns.verbSuffix ?? 's'} and hit${player.pronouns.verbSuffix ?? 's'} ${player.pronouns.him}self instead.`;
						} else if (tie) {
							outcome = `${player.givenName} almost catches a glimpse of ${invisibilityTarget.givenName} but when ${player.pronouns.he} blink${player.pronouns.verbSuffix ?? 's'} ${invisibilityTarget.givenName} is gone.`;
						} else if (success) {
							outcome = `Success. ${player.givenName} catches a glimpse of ${invisibilityTarget.givenName} and attacks.`;
						} else {
							outcome = `Fail. ${invisibilityTarget.givenName} remains ${this.icon} hidden from ${player.givenName}.`;
						}

						this.emit('rolled', {
							success: success,
							reason: `vs ${HIDE_DIFFICULTY} + ${invisibilityTarget.givenName}'s ${this.hideStat} (${hideDifficulty}) to determine if ${player.pronouns.he} can find ${invisibilityTarget.pronouns.him}.`,
							card,
							roll: savingThrow,
							who: player,
							outcome,
							vs: hideDifficulty,
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
									narration: this.revealNarration(invisibilityTarget),
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
				narration: this.hideNarration(invisibilityTarget),
			});
		} else {
			this.emit('narration', {
				narration: this.concealNarration(invisibilityTarget),
			});
		}

		return true;
	}
}

export default CloakOfInvisibilityCard;
