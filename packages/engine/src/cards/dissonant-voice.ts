import { BaseCard, type CardOptions } from './base.js';
import { chance } from '../helpers/chance.js';
import { subEventDelay } from '../helpers/delay-times.js';
import { TARGET_ALL_CONTESTANTS, getTarget } from '../helpers/targeting-strategies.js';
import { ATTACK_PHASE } from '../constants/phases.js';
import { DISSONANT_VOICE_EFFECT } from '../constants/effect-types.js';
import { UNICORN } from '../constants/creature-types.js';
import { BARD } from '../constants/creature-classes.js';
import { ACOUSTIC } from '../constants/card-classes.js';
import { UNCOMMON } from '../helpers/probabilities.js';
import { VERY_CHEAP } from '../helpers/costs.js';

const { roll } = chance;

const DISSONANCE_PENALTY = 2;

/*
 * Aelian (De Animalium Natura, ancient report): of all animals the cartazon has "the most
 * dissonant voice".
 * The card is a rattle, not a silence: one small penalty on one attack, no damage.
 *
 * Player-facing lines quote the old sources (docs/archive/roadmap/28-unicorn-voice-punch-up.md):
 * the description is Topsell (1658 reprint), "There was nothing more horrible then the
 * voice or braying of it, for the voyce is strained above measure"; the ringing ears echo
 * Holland's Pliny (1601), whose monoceros "loweth after an hideous manner".
 */
export class DissonantVoiceCard extends BaseCard {
	static cardClass = [ACOUSTIC];
	static cardType = 'Dissonant Voice';
	static permittedClassesAndTypes = [UNICORN, BARD];
	static probability = UNCOMMON.probability;
	static description =
		'"There was nothing more horrible then the voice or braying of it, for the voyce is strained above measure." Stop thine ears.';
	static level = 1;
	static cost = VERY_CHEAP.cost;
	/**
	 * The attack penalty on a failed save, and an optional sting (dice) on a failed save. Class
	 * settings rather than module constants so the balance harness can try values (roadmap 35).
	 */
	static penalty = DISSONANCE_PENALTY;
	static stingDice: string | undefined = undefined;
	/**
	 * The owner's proposed shape (2026-09-29, roadmap 35): no save, and every opponent's next
	 * attack roll is made twice, keeping the worse. Modest in a duel, strong in a crowd. Every
	 * flat penalty measured 5-11 points below the card it replaced. A class setting for the harness.
	 */
	static disadvantage = false;
	/** In the `disadvantage` shape: roll twice and keep the worse (off leaves one roll). */
	static rollTwice = true;
	/**
	 * In the `disadvantage` shape: the rattle waits for the monster's next card that rolls to
	 * hit, instead of being spent by whatever it plays next (a Blast or a Heal wasted it).
	 */
	static waitsForAttack = false;
	/**
	 * Natural rolls up to this count as a Curse of Loki on the rattled attack, so the target
	 * flings the blow back (Hit's counter). 1 is the normal rule. A wider range lands damage
	 * rather than only moving the roll; attack-roll changes alone barely matter (roadmap 35).
	 */
	static lokiRange = 1;
	/**
	 * In the `disadvantage` shape with `waitsForAttack`: the ringing lasts through up to this
	 * many attacks, and ends early once one lands. 1 is a single attack. Every roll stays a plain
	 * d20, so the natural 1 and 20 keep their meaning (owner rule, 2026-09-29).
	 */
	static untilHit = 1;

	constructor({ icon = '🔔' }: Partial<CardOptions> = {}) {
		super({ icon } as Partial<CardOptions>);
	}

	get stats(): string {
		if ((this.constructor as typeof DissonantVoiceCard).disadvantage) {
			return `Every opponent's next card rolls to hit twice and keeps the worse roll. A card that does not roll to hit (Blast, Heal) uses it up with no effect.
No damage. Does not stack.`;
		}
		return `Each opponent rolls 1d20 + int vs your int. On a failure, their next card takes ${(this.constructor as typeof DissonantVoiceCard).penalty} off its attack roll.${(this.constructor as typeof DissonantVoiceCard).stingDice ? ` The noise also stings: ${(this.constructor as typeof DissonantVoiceCard).stingDice} damage.` : ''} A card that does not roll to hit (Blast, Heal) uses up the penalty with no effect.
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

	rattle(target: any): void {
		const { penalty, disadvantage, rollTwice, waitsForAttack, lokiRange, untilHit } = this.constructor as typeof DissonantVoiceCard;
		let attacksLeft = waitsForAttack && disadvantage ? Math.max(1, untilHit) : 1;
		const unrattle = () => {
			target.encounterEffects = target.encounterEffects.filter(
				(effect: any) => effect !== rattled
			);
		};
		const rattled = ({ card, phase, player }: any) => {
			if (phase !== ATTACK_PHASE || player !== target) return card;

			const { getAttackRoll, hitCheck } = card;
			if (waitsForAttack && disadvantage && typeof getAttackRoll !== 'function') return card;

			// Spent on the next card (or, with `waitsForAttack`, the next that rolls to hit). With
			// `untilHit`, a miss keeps the ringing for the next attack, up to the cap.
			attacksLeft -= 1;
			if (attacksLeft <= 0 || typeof hitCheck !== 'function') {
				unrattle();
			} else {
				card.hitCheck = (...args: any[]) => {
					const result = hitCheck.apply(card, args);
					if (result?.success) unrattle();
					return result;
				};
			}

			if (typeof getAttackRoll === 'function' && disadvantage) {
				this.emit('narration', {
					narration: `${target.givenName}'s ears yet ring with that hideous lowing ${this.icon}${rollTwice ? ' (attacks at disadvantage)' : ''}.`,
				});
				// A natural roll inside `lokiRange` is a curse of Loki (never on a natural 20).
				const curse = (r: any) => {
					const natural = r?.naturalRoll?.result;
					if (!r.strokeOfLuck && typeof natural === 'number' && natural <= lokiRange) {
						r.curseOfLoki = true;
					}
					return r;
				};
				// Both rolls go through the card's own getAttackRoll, so its bonuses apply to each.
				// A curse of Loki is the worst roll and a natural 20 the best, whatever the totals.
				const rank = (r: any) => (r.curseOfLoki ? -Infinity : r.strokeOfLuck ? Infinity : r.result);
				card.getAttackRoll = (...args: any[]) => {
					const first = curse(getAttackRoll.apply(card, args));
					if (!rollTwice) return first;
					const second = curse(getAttackRoll.apply(card, args));
					return rank(second) < rank(first) ? second : first;
				};
			} else if (typeof getAttackRoll === 'function') {
				this.emit('narration', {
					narration: `${target.givenName}'s ears yet ring with that hideous lowing ${this.icon} (-${penalty} to attack).`,
				});
				// `card` is the per-play clone from applyEffects, so wrapping it never leaks
				// into the deck.
				card.getAttackRoll = (...args: any[]) => {
					const attackRoll = getAttackRoll.apply(card, args);
					attackRoll.modifier -= penalty;
					attackRoll.result = Math.max(attackRoll.result - penalty, 0);
					return attackRoll;
				};
			}

			return card;
		};

		rattled.effectType = DISSONANT_VOICE_EFFECT;
		target.encounterEffects = [...target.encounterEffects, rattled];
	}

	async effect(player: any, target: any, ring?: any): Promise<boolean> {
		if ((this.constructor as typeof DissonantVoiceCard).disadvantage) {
			const already = target.encounterEffects.some(
				(effect: any) => effect.effectType === DISSONANT_VOICE_EFFECT
			);
			if (!already) this.rattle(target);
			this.emit('narration', {
				narration: already
					? `${target.givenName} is already rattled.`
					: `${this.icon} ${target.givenName} is rattled!`,
			});
			await subEventDelay(ring?.pacingMultiplier);
			return !target.dead;
		}

		const alreadyRattled = target.encounterEffects.some(
			(effect: any) => effect.effectType === DISSONANT_VOICE_EFFECT
		);
		const saveRoll = this.getSaveRoll(target);
		const { success } = this.checkSuccess(saveRoll, player.int);
		const whose = player === target ? `${player.pronouns.his} own` : `${player.givenName}'s`;
		let outcome: string;

		if (success) {
			outcome = `${target.givenName} shakes it off.`;
		} else if (alreadyRattled) {
			outcome = `${target.givenName} is already rattled.`;
		} else {
			outcome = `${target.givenName} is rattled!`;
		}

		this.emit('rolled', {
			reason: `vs ${whose} int (${player.int}) to keep ${target.pronouns.his} focus.`,
			card: this,
			roll: saveRoll,
			who: target,
			outcome,
			vs: player.int,
		});

		if (!success && !alreadyRattled) {
			this.rattle(target);
			const { stingDice } = this.constructor as typeof DissonantVoiceCard;
			if (stingDice && player !== target) {
				await target.hit(roll({ primaryDice: stingDice }).result, player, this);
			}
		}

		// One save per sub-event beat, so a crowded ring does not dump every roll in one tick.
		await subEventDelay(ring?.pacingMultiplier);

		return !target.dead;
	}
}

export default DissonantVoiceCard;
