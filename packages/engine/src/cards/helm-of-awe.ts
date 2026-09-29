import { BaseCard, type CardOptions } from './base.js';
import { chance } from '../helpers/chance.js';
import { subEventDelay } from '../helpers/delay-times.js';
import { TARGET_ALL_CONTESTANTS, getTarget } from '../helpers/targeting-strategies.js';
import { ATTACK_PHASE } from '../constants/phases.js';
import { AWE_EFFECT } from '../constants/effect-types.js';
import { DRAGON } from '../constants/creature-types.js';
import { RARE } from '../helpers/probabilities.js';
import { PRICEY } from '../helpers/costs.js';
import { wardAgainst, controlWardNarration } from './helpers/control-ward.js';
import { agree } from '../helpers/pronouns.js';

const { roll } = chance;

const AWE_DC_BASE = 10;

/*
 * Every opponent rolls 1d20 + its int modifier against 10 + the dragon's int modifier; each
 * that fails is awed for its next `aweCards` plays. Modelled on Dissonant Voice's `rattle()`
 * (an ATTACK_PHASE encounter effect on the target that wraps `getAttackRoll` on the per-play
 * clone), but counting down plays rather than lasting one. Being awed again refreshes the
 * count and never stacks the penalty. Awe is a negative non-damage effect, so it goes through
 * `wardAgainst` (Horn of Proof's ward cancels it). Source for the card's text: Fafnir's helm
 * of awe in the Volsunga saga.
 *
 * Player-facing text (written by the orchestrator, roadmap 35 task 8, in the Norse voice the
 * owner asked for): in the Völsunga saga (Morris and Magnússon's 1888 English) Fafnir the
 * worm wears the helm of awe (ægishjálmr) as he lies on his hoard, and every living thing fears
 * him. The verse is an original quatrain in the manner of the Eddas. The shouted Viking is the
 * pack's joke about controlling a dragon by yelling at it (owner, 2026-09-29).
 */
export class HelmOfAweCard extends BaseCard {
	static cardType = 'Helm of Awe';
	static permittedClassesAndTypes = [DRAGON];
	static probability = RARE.probability;
	static description =
		'Helm of awe on the hoard-guard\'s brow: the bold go pale, the proud bow low. Fafnir wore it on his gold, and no man stood before him. Shouting "SIT!" at a dragon in the helm does not work. It has been tried.';
	static level = 2;
	static cost = PRICEY.cost;
	static notForSale = true;
	/** How many of the opponent's plays are awed; a class setting for the harness. */
	static aweCards = 3;
	/** The attack penalty on each awed play; a class setting for the harness. */
	static awePenalty = 2;
	/**
	 * The shipped shape: a failed save makes the opponent cower and lose its next `cowerCards`
	 * cards. Off, it takes the attack penalty instead (kept for the harness).
	 */
	// Roadmap 35 (measured 2026-09-29): an attack-roll penalty (-2 for 3 cards, -5, or -2 for a
	// whole round) left the card 5-8 points below the card it replaced. Cowering, two lost cards,
	// is near a Hit in a duel and hits every opponent in a crowd.
	static cower = true;
	/** Cards a cowering opponent loses; a class setting for the harness (roadmap 35). */
	static cowerCards = 2;
	/**
	 * The hold shape (owner idea, 2026-09-29): an awed opponent is held like Coil's victim. At
	 * the start of each of its turns it saves again (1d20 + int vs the same DC, less
	 * `holdFatigue` for each turn already awed); a failure loses that card, a success ends the
	 * awe. Class settings for the harness while the shapes are measured.
	 */
	static hold = false;
	static holdFatigue = 3;
	/**
	 * When true, the failed save that awes the opponent costs its next card outright, and the
	 * rolls to recover begin on the turn after. When false, the opponent rolls to recover on its
	 * very next turn, so it must fail twice to lose anything.
	 */
	static holdFirstCardLost = true;
	/**
	 * What a natural 1 on an awe save does in the hold shape: `none`; `flee`, the monster runs
	 * from the ring; `attempt`, it tries to, and flees on 1d20 + dex of 10 or more, as the Flee
	 * card does. Bosses never flee (they never hold Flee either); a boss that rolls the 1
	 * only cowers.
	 */
	static fleeOnLoki: 'none' | 'flee' | 'attempt' = 'none';

	constructor({ icon = '🐲' }: Partial<CardOptions> = {}) {
		super({ icon } as Partial<CardOptions>);
	}

	get stats(): string {
		const { aweCards, awePenalty, cower, cowerCards, hold, holdFatigue, fleeOnLoki } = this.constructor as typeof HelmOfAweCard;
		if (hold) {
			const flee = fleeOnLoki === 'none'
				? ''
				: fleeOnLoki === 'flee'
					? ' A natural 1 on any of these rolls sends them fleeing from the ring (bosses only cower).'
					: ' A natural 1 on any of these rolls makes them try to flee (1d20 + dex, 10 or more; bosses only cower).';
			const { holdFirstCardLost } = this.constructor as typeof HelmOfAweCard;
			return `Each opponent rolls 1d20 + int vs ${AWE_DC_BASE} + your int modifier. On a failure they are awed${holdFirstCardLost ? ' and lose their next card' : ''}: at the start of each ${holdFirstCardLost ? 'later turn' : 'of their turns'} they roll again${holdFatigue ? ` (${holdFatigue} easier for each turn already awed)` : ''}, and on a failure they cower and lose that card.${flee}
No damage. Does not stack.`;
		}
		if (cower) {
			const lost = cowerCards === 1 ? 'next card (it does nothing)' : `next ${cowerCards} cards (they do nothing)`;
			return `Each opponent rolls 1d20 + int vs ${AWE_DC_BASE} + your int modifier. On a failure, they cower and lose their ${lost}.
No damage. Does not stack.`;
		}
		return `Each opponent rolls 1d20 + int vs ${AWE_DC_BASE} + your int modifier. On a failure, their next ${aweCards} cards each take ${awePenalty} off their attack rolls. A card that does not roll to hit (Blast, Heal) uses up one of the ${aweCards} with no effect.
No damage. Does not stack; being awed again refreshes the count.`;
	}

	override getTargets(player: any, proposedTarget: any, ring: any, activeContestants: any): any[] {
		if (!activeContestants) return [proposedTarget];

		// Opponents only: getTarget already honours teams and a ring's free-for-all policy.
		return (getTarget({
			contestants: activeContestants,
			playerMonster: player,
			strategy: TARGET_ALL_CONTESTANTS,
			ring,
		}) as any[]).map(({ monster }: any) => monster);
	}

	getSaveRoll(target: any): any {
		return roll({
			primaryDice: '1d20',
			modifier: target.intModifier,
			bonusDice: target.bonusIntDice,
			crit: true,
		});
	}

	static isAwed(target: any): boolean {
		return target.encounterEffects.some((effect: any) => effect.effectType === AWE_EFFECT);
	}

	/**
	 * The `cower` shape: `target` loses its next `cowerCards` cards. Shares AWE_EFFECT so a second
	 * awe replaces this one rather than stacking.
	 */
	cowerTarget(target: any): void {
		let cardsLeft = (this.constructor as typeof HelmOfAweCard).cowerCards;
		const cowering = ({ card, phase, player }: any) => {
			if (phase !== ATTACK_PHASE || player !== target) return card;

			cardsLeft -= 1;
			if (cardsLeft <= 0) target.encounterEffects = target.encounterEffects.filter((effect: any) => effect !== cowering);
			this.emit('narration', {
				narration: `${this.icon} ${target.givenName} cannot bear the dragon's gaze, and cowers behind ${target.pronouns.his} shield instead of acting.`,
			});
			// `card` is the per-play clone from applyEffects, so replacing play never leaks
			// into the deck (same as ImmobilizeCard).
			card.play = () => Promise.resolve(!player.dead);
			return card;
		};

		cowering.effectType = AWE_EFFECT;
		target.encounterEffects = [
			...target.encounterEffects.filter((effect: any) => effect.effectType !== AWE_EFFECT),
			cowering,
		];
	}

	/** A flee roll as the Flee card makes it: 1d20 + dex, 10 or more. */
	getFleeRoll(target: any): any {
		return roll({ primaryDice: '1d20', modifier: target.dexModifier, crit: true });
	}

	/**
	 * The `hold` shape: `target` saves again at the start of each of its turns until it shakes
	 * the awe off; each failure loses that card. A natural 1 may send it running (`fleeOnLoki`).
	 * The awe ends if the dragon dies. Shares AWE_EFFECT, so a second awe never stacks.
	 */
	holdTarget(target: any, dragon: any, dc: number): void {
		const { holdFatigue, fleeOnLoki, holdFirstCardLost } = this.constructor as typeof HelmOfAweCard;
		let turnsAwed = 0;
		let firstTurn = holdFirstCardLost;
		const remove = () => {
			target.encounterEffects = target.encounterEffects.filter((effect: any) => effect !== awed);
		};
		const awed = async ({ card, phase, player, activeContestants }: any) => {
			if (phase !== ATTACK_PHASE || player !== target) return card;
			if (dragon.dead) {
				remove();
				return card;
			}

			if (firstTurn) {
				firstTurn = false;
				turnsAwed += 1;
				this.emit('narration', {
					narration: `${this.icon} ${target.givenName} cannot bear the dragon's gaze, and cowers behind ${target.pronouns.his} shield instead of acting.`,
				});
				card.play = () => Promise.resolve(!player.dead);
				return card;
			}

			const threshold = Math.max(1, dc - (turnsAwed - (holdFirstCardLost ? 1 : 0)) * holdFatigue);
			const saveRoll = this.getSaveRoll(target);
			const { success, curseOfLoki } = this.checkSuccess(saveRoll, threshold);
			const flees = curseOfLoki && fleeOnLoki !== 'none' && !target.isBoss;
			this.emit('rolled', {
				reason: `vs ${threshold} to meet the dragon's eye.`,
				card: this,
				roll: saveRoll,
				who: target,
				outcome: success
					? `${target.givenName} finds ${target.pronouns.his} courage and meets the dragon's eye.`
					: flees
						? `${target.givenName} looks once more upon the helm of awe.`
						: `${target.givenName} cannot bear the dragon's gaze.`,
				vs: threshold,
			});

			if (success) {
				remove();
				return card;
			}

			turnsAwed += 1;
			if (flees) {
				let runs = fleeOnLoki === 'flee';
				if (!runs) {
					const fleeRoll = this.getFleeRoll(target);
					// Strict `<` in checkSuccess: 9 makes a natural 10 succeed, as Flee does.
					runs = this.checkSuccess(fleeRoll, 9).success;
					this.emit('rolled', {
						reason: 'and needs 10 or higher to flee.',
						card: this,
						roll: fleeRoll,
						who: target,
						outcome: runs ? 'Away!' : 'Rooted to the sand!',
					});
				}
				if (runs) {
					remove();
					this.emit('narration', {
						narration: `${this.icon} The courage runs out of ${target.givenName} like mead from a cracked horn, and ${target.pronouns.he} ${agree(target.pronouns, 'flees', 'flee')} the ring!`,
					});
					card.play = () => Promise.resolve(target.leaveCombat(activeContestants));
					return card;
				}
			}

			this.emit('narration', {
				narration: `${this.icon} ${target.givenName} cowers behind ${target.pronouns.his} shield instead of acting.`,
			});
			// `card` is the per-play clone from applyEffects, so replacing play never leaks
			// into the deck (same as ImmobilizeCard).
			card.play = () => Promise.resolve(!player.dead);
			return card;
		};

		awed.effectType = AWE_EFFECT;
		target.encounterEffects = [
			...target.encounterEffects.filter((effect: any) => effect.effectType !== AWE_EFFECT),
			awed,
		];
	}

	/** Awes `target` for `aweCards` plays, replacing any awe already on it (refresh, not stack). */
	awe(target: any, dragon?: any, dc?: number): void {
		const { aweCards, awePenalty, cower, hold } = this.constructor as typeof HelmOfAweCard;
		if (hold && dragon) {
			this.holdTarget(target, dragon, dc ?? AWE_DC_BASE);
			return;
		}
		if (cower) {
			this.cowerTarget(target);
			return;
		}
		let remaining = aweCards;

		const awed = ({ card, phase, player }: any) => {
			if (phase !== ATTACK_PHASE || player !== target) return card;

			// Every play counts, whether or not it attacks.
			remaining -= 1;
			if (remaining <= 0) {
				target.encounterEffects = target.encounterEffects.filter((effect: any) => effect !== awed);
			}

			const { getAttackRoll } = card;
			if (typeof getAttackRoll === 'function') {
				this.emit('narration', {
					narration: `${target.givenName} still cannot meet the dragon's eye ${this.icon} (-${awePenalty} to attack).`,
				});
				// `card` is the per-play clone from applyEffects, so wrapping it never leaks
				// into the deck.
				card.getAttackRoll = (...args: any[]) => {
					const attackRoll = getAttackRoll.apply(card, args);
					attackRoll.modifier -= awePenalty;
					attackRoll.result = Math.max(attackRoll.result - awePenalty, 0);
					return attackRoll;
				};
			}

			return card;
		};

		awed.effectType = AWE_EFFECT;
		target.encounterEffects = [
			...target.encounterEffects.filter((effect: any) => effect.effectType !== AWE_EFFECT),
			awed,
		];
	}

	async effect(player: any, target: any, ring?: any, activeContestants?: any): Promise<boolean> {
		const dc = AWE_DC_BASE + player.intModifier;
		// In the hold shape a second awe never refreshes the first: a reset would let a hand of
		// Helms keep an opponent cowering, as a re-cast Coil cannot.
		if ((this.constructor as typeof HelmOfAweCard).hold && HelmOfAweCard.isAwed(target)) {
			this.emit('narration', {
				narration: `${target.givenName} is already cowering before the helm.`,
			});
			await subEventDelay(ring?.pacingMultiplier);
			return !target.dead;
		}
		const saveRoll = this.getSaveRoll(target);
		const { success } = this.checkSuccess(saveRoll, dc);
		const outcome = success
			? `${target.givenName} stands ${target.pronouns.his} ground and stares back.`
			: `${target.givenName} looks upon the helm of awe, and ${target.pronouns.his} knees turn to water.`;

		this.emit('rolled', {
			reason: `vs ${AWE_DC_BASE} + ${player.givenName}'s int modifier (${dc}) to resist awe.`,
			card: this,
			roll: saveRoll,
			who: target,
			outcome,
			vs: dc,
		});

		if (!success) {
			if (wardAgainst(target, player, { activeContestants, ring })) {
				this.emit('narration', {
					narration: controlWardNarration(target, 'will not be awed.'),
				});
			} else {
				this.awe(target, player, dc);
			}
		}

		// One save per sub-event beat, so a crowded ring does not dump every roll in one tick.
		await subEventDelay(ring?.pacingMultiplier);

		return !target.dead;
	}
}

export default HelmOfAweCard;
