import { CurseCard } from './curse.js';
import { WEEPING_ANGEL } from '../constants/creature-types.js';
import { ATTACK_PHASE, DEFENSE_PHASE } from '../constants/phases.js';
import { chance } from '../helpers/chance.js';
import { EPIC } from '../helpers/probabilities.js';
import { EXPENSIVE } from '../helpers/costs.js';
import { PSYCHIC } from '../constants/card-classes.js';
import { wardAgainst, controlWardNarration } from './helpers/control-ward.js';
import { releaseWhenCasterFalls } from './helpers/caster-falls.js';

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
		return `1d20 + int vs opponent's int. They are removed from the fight (and can not be targeted).\nOn what would have been their next turn, you drain ${this.energyToStealDice} hp and ${this.curseAmountDice} ${this.cursedProp}\nIf you fall first, they are back in the fight at once\nOn a natural 1 you blink first: frozen in stone, you lose your next turn`;
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
			success: attackSuccess.success,
			reason: timeShiftReason,
			card: this,
			roll: attackRoll,
			who: blinkPlayer,
			outcome: `Time shift ${attackSuccess.success ? 'succeeded!' : 'failed.'} ${blinkTarget.givenName} ${attackSuccess.success ? 'blinked!' : 'did not blink. The Doctor would be proud.'}`,
			vs: blinkTarget.int,
		});

		if (attackSuccess.success) {
			// Horn of Proof ward: an armed ward cancels the whole time-shift right here, before
			// any BlinkEffect or timeShifted flag exists, so nothing dangles and the later
			// drain (inside that effect's ATTACK_PHASE branch) never gets the chance to run.
			if (wardAgainst(blinkTarget, blinkPlayer, { activeContestants, ring })) {
				this.emit('narration', {
					narration: controlWardNarration(blinkTarget, 'will not be blinked away.'),
				});
				return true;
			}

			// A confused angel that blinks itself is frozen, not shifted: a shift would make it
			// untargetable, which is a gift (roadmap 51 review).
			if (blinkPlayer === blinkTarget) return this.freeze(blinkPlayer);
			return this.shift(blinkPlayer, blinkTarget, ring);
		}

		this.emit('miss', {
			attackResult: attackRoll.result,
			attackRoll,
			player: blinkPlayer,
			target: blinkTarget,
			curseOfLoki: attackSuccess.curseOfLoki,
		});

		/*
		 * A natural 1 backfires (roadmap 51: a natural 1 on your own move backfires, as a Hit is
		 * flung back). The angel blinks first and is frozen in stone: it loses its next turn but
		 * stays in the fight and can be hit. Shifting it instead, as first built, made it
		 * untargetable, so the opponent lost more turns than the angel did (roadmap 51 review).
		 */
		if (attackSuccess.curseOfLoki) {
			this.emit('narration', {
				narration: `${this.icon} ${blinkPlayer.givenName} blinks first, and is frozen in stone.`,
			});
			return this.freeze(blinkPlayer);
		}

		return true;
	}

	/**
	 * Lose the angel's next turn. A `control` stage effect, like a hold: time still passes for a
	 * statue, so burns tick and upkeep runs, and it stays a target the whole time.
	 */
	private freeze(angel: any): boolean {
		const frozenEffect = ({ card, phase }: any) => {
			if (phase !== ATTACK_PHASE) return card;
			angel.encounterEffects = angel.encounterEffects.filter((effect: any) => effect !== frozenEffect);
			this.emit('narration', {
				narration: `${this.icon} ${angel.givenName} is still frozen in stone, and loses this turn.`,
			});
			card.play = () => Promise.resolve(!angel.dead);
			return card;
		};
		frozenEffect.effectType = 'BlinkFrozenEffect';
		(frozenEffect as any).turnStart = 'control';
		angel.encounterEffects = [...angel.encounterEffects, frozenEffect];
		return true;
	}

	/** Take the target out of time until what would have been its next turn. */
	private shift(blinkPlayer: any, blinkTarget: any, ring: any): boolean {
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
						mechanic: 'time-shift',
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
					stopListening();

					this.emit('narration', {
						narration: `${blinkTarget.identity} opens ${blinkTarget.pronouns.his} eyes and finds ${blinkTarget.pronouns.him}self in an unfamiliar time.`,
					});
				}
			}

			return card;
		};

		blinkEffect.effectType = 'BlinkEffect';
		(blinkEffect as any).turnStart = 'timeShift';

		/*
		 * The angel falls: the shift breaks at once, and the feed says so (owner, 2026-10-12;
		 * live check 49b). It used to wait for the victim's next turn, which then read only
		 * "opens his eyes … in an unfamiliar time". Permadeath for the victim was ruled out:
		 * Destroy is the permadeath card. The victim's-turn path above stays as the fallback
		 * for a death with no assailant, which emits no `die`. helpers/caster-falls.ts has the
		 * rule for every effect a fall ends.
		 */
		// A confused angel that blinked itself has nobody to release when it falls.
		const { stop: stopListening } = blinkPlayer === blinkTarget ? { stop: () => {} } : releaseWhenCasterFalls({
			caster: blinkPlayer,
			holder: blinkTarget,
			effect: blinkEffect,
			release: () => {
				blinkTarget.encounterModifiers.timeShifted = false;
				blinkTarget.encounterModifiers.blinkedTurns = 0;
				blinkTarget.encounterEffects = blinkTarget.encounterEffects.filter(
					(encounterEffect: any) => encounterEffect !== blinkEffect
				);
			},
			narrate: narration => this.emit('narration', { narration }),
			line: `the time-shift breaks. ${blinkTarget.givenName} is back in the fight.`,
			icon: this.icon,
		});
		blinkTarget.encounterModifiers.timeShifted = true;
		blinkTarget.encounterEffects = [
			...blinkTarget.encounterEffects,
			blinkEffect,
		];

		return true;
	}
}

export default BlinkCard;
