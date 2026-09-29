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
		const { penalty, disadvantage } = this.constructor as typeof DissonantVoiceCard;
		const rattled = ({ card, phase, player }: any) => {
			if (phase !== ATTACK_PHASE || player !== target) return card;

			// Spent on the next card, whether or not it attacks: a one-play penalty.
			target.encounterEffects = target.encounterEffects.filter(
				(effect: any) => effect !== rattled
			);

			const { getAttackRoll } = card;
			if (typeof getAttackRoll === 'function' && disadvantage) {
				this.emit('narration', {
					narration: `${target.givenName}'s ears yet ring with that hideous lowing ${this.icon} (attacks at disadvantage).`,
				});
				// Both rolls go through the card's own getAttackRoll, so its bonuses apply to each.
				// A curse of Loki is the worst roll and a natural 20 the best, whatever the totals.
				const rank = (r: any) => (r.curseOfLoki ? -Infinity : r.strokeOfLuck ? Infinity : r.result);
				card.getAttackRoll = (...args: any[]) => {
					const first = getAttackRoll.apply(card, args);
					const second = getAttackRoll.apply(card, args);
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
