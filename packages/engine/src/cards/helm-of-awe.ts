import { BaseCard, type CardOptions } from './base.js';
import { chance } from '../helpers/chance.js';
import { subEventDelay } from '../helpers/delay-times.js';
import { TARGET_ALL_CONTESTANTS, getTarget } from '../helpers/targeting-strategies.js';
import { ATTACK_PHASE, DEFENSE_PHASE } from '../constants/phases.js';
import { AWE_EFFECT } from '../constants/effect-types.js';
import { DRAGON } from '../constants/creature-types.js';
import { RARE } from '../helpers/probabilities.js';
import { PRICEY } from '../helpers/costs.js';
import { wardAgainst, controlWardNarration } from './helpers/control-ward.js';
import { agree } from '../helpers/pronouns.js';
import { advantageAgainstPinned } from './helpers/pinned.js';

const { roll } = chance;

const AWE_DC_BASE = 10;

/*
 * Every opponent rolls 1d20 + its int modifier against 10 + the dragon's int modifier. Each
 * that fails is awed, a pin like Coil's victim (owner, 2026-09-29): it loses its next card
 * outright, then at the start of each later turn it saves again, `holdFatigue` easier for each
 * turn already awed, losing that card on a failure and recovering on a success. The awe ends
 * if the dragon dies. On a natural 1, a monster that is not bloodied tries to flee, and a
 * bloodied one cowers: the injured cower on the ground, the healthy run while they still have
 * the strength, the owner's twist on D&D fear. Bosses can be frightened away too; the rule that
 * bosses never flee is about the Flee cards they carry, not about fear.
 *
 * Why this shape (roadmap 35; the study is docs/archive/studies/2026-09-helm-of-awe-and-dissonant-voice.md):
 * attack-roll penalties left the card 5-8 points below the card it replaced; the pin matched
 * that card one-on-one, in crowds, and in team battles. A hand of Helms makes the dragon
 * weaker, not a lock, because a second helm never refreshes the first. Awe is a negative
 * non-damage effect, so it goes through `wardAgainst` (Horn of Proof's ward cancels it).
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
	/** How much easier each recovery save is, per turn already awed; a class setting for the harness. */
	static holdFatigue = 3;
	/** `healthy`: on a natural 1 a monster that is not bloodied tries to flee. `none` is kept for the harness. */
	static fleeOnLoki: 'none' | 'healthy' = 'healthy';

	constructor({ icon = '🐲' }: Partial<CardOptions> = {}) {
		super({ icon } as Partial<CardOptions>);
	}

	get stats(): string {
		const { holdFatigue, fleeOnLoki } = this.constructor as typeof HelmOfAweCard;
		const flee = fleeOnLoki === 'healthy'
			? '\nOn a natural 1, an opponent that is not bloodied tries to flee the ring (1d20 + dex, 10 or more); a bloodied one cowers.'
			: '';
		return `Each opponent rolls 1d20 + int vs ${AWE_DC_BASE} + your int modifier. On a failure they are awed and lose their next card.
At the start of each later turn they roll again, ${holdFatigue} easier each time: on a failure they cower and lose that card, on a success they recover.${flee}
No damage. Does not stack.`;
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

	/** A flee roll as the Flee card makes it: 1d20 + dex, 10 or more. */
	getFleeRoll(target: any): any {
		return roll({ primaryDice: '1d20', modifier: target.dexModifier, crit: true });
	}

	static isAwed(target: any): boolean {
		return target.encounterEffects.some((effect: any) => effect.effectType === AWE_EFFECT);
	}

	/**
	 * Awes `target`: it loses its next card, then saves at the start of each later turn until it
	 * recovers. `dc` is the save the dragon set when the helm was played.
	 */
	awe(target: any, dragon: any, dc: number): void {
		const { holdFatigue, fleeOnLoki } = this.constructor as typeof HelmOfAweCard;
		let turnsAwed = 0;
		const remove = () => {
			target.encounterEffects = target.encounterEffects.filter((effect: any) => effect !== awed);
		};
		const cower = (card: any, player: any) => {
			this.emit('narration', {
				narration: `${this.icon} ${target.givenName} cannot bear the dragon's gaze, and cowers behind ${target.pronouns.his} shield instead of acting.`,
			});
			// `card` is the per-play clone from applyEffects, so replacing play never leaks
			// into the deck (same as ImmobilizeCard).
			card.play = () => Promise.resolve(!player.dead);
			return card;
		};

		const awed = async ({ card, phase, player, activeContestants }: any) => {
			// Roadmap 36: an awed monster is pinned, so attacks against it roll with advantage.
			if (phase === DEFENSE_PHASE && !dragon.dead) {
				return advantageAgainstPinned(target, card, narration => this.emit('narration', { narration }));
			}
			if (phase !== ATTACK_PHASE || player !== target) return card;
			if (dragon.dead) {
				remove();
				return card;
			}

			turnsAwed += 1;
			// The failed save that awed it already cost this card.
			if (turnsAwed === 1) return cower(card, player);

			const threshold = Math.max(1, dc - (turnsAwed - 2) * holdFatigue);
			const saveRoll = this.getSaveRoll(target);
			const { success, curseOfLoki } = this.checkSuccess(saveRoll, threshold);
			const triesToFlee = curseOfLoki && fleeOnLoki === 'healthy' && !target.bloodied;
			this.emit('rolled', {
				reason: `vs ${threshold} to meet the dragon's eye.`,
				card: this,
				roll: saveRoll,
				who: target,
				outcome: success
					? `${target.givenName} finds ${target.pronouns.his} courage and meets the dragon's eye.`
					: triesToFlee
						? `${target.givenName} looks once more upon the helm of awe, and turns to run.`
						: `${target.givenName} still cannot bear the dragon's gaze.`,
				vs: threshold,
			});

			if (success) {
				remove();
				return card;
			}

			if (triesToFlee) {
				const fleeRoll = this.getFleeRoll(target);
				// Strict `<` in checkSuccess: 9 makes a natural 10 succeed, as Flee does.
				const runs = this.checkSuccess(fleeRoll, 9).success;
				this.emit('rolled', {
					reason: 'and needs 10 or higher to flee.',
					card: this,
					roll: fleeRoll,
					who: target,
					outcome: runs ? 'Away!' : 'Rooted to the sand!',
				});
				if (runs) {
					remove();
					this.emit('narration', {
						narration: `${this.icon} The courage runs out of ${target.givenName} like mead from a cracked horn, and ${target.pronouns.he} ${agree(target.pronouns, 'flees', 'flee')} the ring!`,
					});
					card.play = () => Promise.resolve(target.leaveCombat(activeContestants));
					return card;
				}
			}

			return cower(card, player);
		};

		awed.effectType = AWE_EFFECT;
		target.encounterEffects = [...target.encounterEffects, awed];
	}

	async effect(player: any, target: any, ring?: any, activeContestants?: any): Promise<boolean> {
		// A second helm never refreshes the first: a reset would let a hand of Helms keep an
		// opponent cowering, as a re-cast Coil cannot.
		if (HelmOfAweCard.isAwed(target)) {
			this.emit('narration', {
				narration: `${target.givenName} is already cowering before the helm.`,
			});
			await subEventDelay(ring?.pacingMultiplier);
			return !target.dead;
		}

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
				this.awe(target, player, dc);
			}
		}

		// One save per sub-event beat, so a crowded ring does not dump every roll in one tick.
		await subEventDelay(ring?.pacingMultiplier);

		return !target.dead;
	}
}

export default HelmOfAweCard;
