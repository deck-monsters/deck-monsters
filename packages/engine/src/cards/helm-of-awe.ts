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

	constructor({ icon = '🐲' }: Partial<CardOptions> = {}) {
		super({ icon } as Partial<CardOptions>);
	}

	get stats(): string {
		const { aweCards, awePenalty } = this.constructor as typeof HelmOfAweCard;
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

	/** Awes `target` for `aweCards` plays, replacing any awe already on it (refresh, not stack). */
	awe(target: any): void {
		const { aweCards, awePenalty } = this.constructor as typeof HelmOfAweCard;
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
				this.awe(target);
			}
		}

		// One save per sub-event beat, so a crowded ring does not dump every roll in one tick.
		await subEventDelay(ring?.pacingMultiplier);

		return !target.dead;
	}
}

export default HelmOfAweCard;
