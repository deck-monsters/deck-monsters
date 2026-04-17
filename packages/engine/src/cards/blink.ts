import { CurseCard } from './curse.js';
import { WEEPING_ANGEL } from '../constants/creature-types.js';
import { ATTACK_PHASE, DEFENSE_PHASE } from '../constants/phases.js';
import { chance } from '../helpers/chance.js';
import { EPIC } from '../helpers/probabilities.js';
import { EXPENSIVE } from '../helpers/costs.js';
import { PSYCHIC } from '../constants/card-classes.js';

const { roll } = chance;

export class BlinkCard extends CurseCard {
	static cardClass = [PSYCHIC];
	static cardType = 'Blink';
	static permittedClassesAndTypes = [WEEPING_ANGEL];
	static probability = EPIC.probability;
	static description = "Consume your victim's potential energy";
	static level = 0;
	static cost = EXPENSIVE.cost;
	static notForSale = true;
	static defaults = {
		...CurseCard.defaults,
		turnsToBlink: 1,
		energyToStealDice: '1d4',
		curseAmountDice: '4d4',
		cursedProp: 'xp',
		hasChanceToHit: false,
	};

	constructor({
		turnsToBlink,
		energyToStealDice,
		curseAmountDice,
		cursedProp,
		hasChanceToHit,
		icon = '⏳',
	}: Record<string, any> = {}) {
		super({ cursedProp, hasChanceToHit, icon });
		this.setOptions({ turnsToBlink, energyToStealDice, curseAmountDice } as any);
	}

	get turnsToBlink(): number {
		return (this.options as any).turnsToBlink;
	}

	get energyToStealDice(): string {
		return (this.options as any).energyToStealDice;
	}

	get curseAmountDice(): string {
		return (this.options as any).curseAmountDice;
	}

	getCurseNarrative(player: any, target: any): string {
		return `${player.givenName} drains xp from ${target.givenName}.`;
	}

	getCurseOverflowNarrative(player: any, target: any): string {
		return `${target.givenName}'s xp penalties have been maxed out.\n${player.givenName}'s drain takes from hp instead.`;
	}

	override get stats(): string {
		return `1d20 vs opponent's int. They are removed from the battle (and can not be targeted).\nOn what would have been their next turn, if you are still alive you drain ${this.energyToStealDice} hp and ${this.curseAmountDice} ${this.cursedProp}`;
	}

	override effect(
		blinkPlayer: any,
		blinkTarget: any,
		ring: any,
		activeContestants: any
	): any {
		blinkTarget.encounterModifiers.blinkedTurns = 0;
		const attackRoll = this.getAttackRoll(blinkPlayer);
		const attackSuccess = this.checkSuccess(attackRoll, blinkTarget.int);

		let timeShiftReason: string;
		if (blinkPlayer === blinkTarget) {
			timeShiftReason = `vs ${blinkTarget.pronouns.his} own int (${blinkTarget.int}) in confusion.`;
		} else {
			timeShiftReason = `vs ${blinkTarget.givenName}'s int (${blinkTarget.int}) in an attempt to time-shift ${blinkTarget.pronouns.him}.`;
		}

		this.emit('rolled', {
			reason: timeShiftReason,
			card: this,
			roll: attackRoll,
			who: blinkPlayer,
			outcome: `Time shift ${attackSuccess.success ? 'succeeded!' : 'failed.'} ${blinkTarget.givenName} ${attackSuccess.success ? 'blinked!' : 'did not blink. The Doctor would be proud.'}`,
			vs: blinkTarget.int,
		});

		if (attackSuccess.success) {
			const blinkEffect = async ({ card, phase }: any) => {
				const { effect } = card;

				if (effect && phase === DEFENSE_PHASE) {
					card.effect = (
						player: any,
						target: any,
						effectRing: any,
						effectActiveContestants: any
					) => {
						if (target === blinkTarget) {
							this.emit('effect', {
								effectResult: `not target-able because they are ${this.icon} time-shifted by`,
								player: blinkPlayer,
								target: blinkTarget,
								effectRing,
							});
							return !blinkTarget.dead;
						}
						return effect.call(
							card,
							player,
							target,
							effectRing,
							effectActiveContestants
						);
					};
				} else if (phase === ATTACK_PHASE) {
					const turnsLeftToBlink =
						this.turnsToBlink - blinkTarget.encounterModifiers.blinkedTurns;
					if (turnsLeftToBlink && !blinkPlayer.dead) {
						blinkTarget.encounterModifiers.blinkedTurns++;

						const effectResult = `${this.icon} time-shifted for ${turnsLeftToBlink} more turn${turnsLeftToBlink > 1 ? 's' : ''} by`;
						this.emit('effect', {
							effectResult,
							player: blinkPlayer,
							target: blinkTarget,
							ring,
						});

						const hpToSteal = roll({ primaryDice: this.energyToStealDice });
						const xpToSteal = roll({ primaryDice: this.curseAmountDice });
						const combinedRoll = {
							primaryDice: `${hpToSteal.primaryDice} (hp) & ${xpToSteal.primaryDice} (xp)`,
							result: `${hpToSteal.result} (hp) & ${xpToSteal.result} (xp)`,
							naturalRoll: {
								result: `${hpToSteal.naturalRoll.result} & ${xpToSteal.naturalRoll.result}`,
							},
							bonusResult: 0,
							modifier: 0,
						};
						this.curseAmount = -xpToSteal.result;

						let potentialEngeryReason: string;
						if (blinkPlayer === blinkTarget) {
							potentialEngeryReason = `to steal potential energy from ${blinkTarget.pronouns.him}self.`;
						} else {
							potentialEngeryReason = `to steal potential energy from ${blinkTarget.identityWithHp}.`;
						}

						this.emit('rolled', {
							reason: potentialEngeryReason,
							card: this,
							roll: combinedRoll,
							who: blinkPlayer,
						});

						await blinkTarget.hit(hpToSteal.result, blinkPlayer, this);
						await blinkPlayer.heal(hpToSteal.result, blinkTarget, this);

						await super.effect(blinkPlayer, blinkTarget, ring);
						blinkPlayer.setModifier(this.cursedProp, xpToSteal.result);

						card.play = () => Promise.resolve(true);
					} else {
						blinkTarget.encounterModifiers.timeShifted = false;
						blinkTarget.encounterModifiers.blinkedTurns = 0;
						blinkTarget.encounterEffects =
							blinkTarget.encounterEffects.filter(
								(encounterEffect: any) =>
									encounterEffect.effectType !== 'BlinkEffect'
							);

						this.emit('narration', {
							narration: `${blinkTarget.identity} opens ${blinkTarget.pronouns.his} eyes and finds ${blinkTarget.pronouns.him}self in an unfamiliar time.`,
						});
					}
				}

				return card;
			};

			blinkEffect.effectType = 'BlinkEffect';
			blinkTarget.encounterModifiers.timeShifted = true;
			blinkTarget.encounterEffects = [
				...blinkTarget.encounterEffects,
				blinkEffect,
			];

			return true;
		}

		this.emit('miss', {
			attackResult: attackRoll.result,
			attackRoll,
			player: blinkPlayer,
			target: blinkTarget,
		});

		return true;
	}
}

export default BlinkCard;
