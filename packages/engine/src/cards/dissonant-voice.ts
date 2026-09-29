import { BaseCard, type CardOptions } from './base.js';
import { subEventDelay } from '../helpers/delay-times.js';
import { TARGET_ALL_CONTESTANTS, getTarget } from '../helpers/targeting-strategies.js';
import { ATTACK_PHASE } from '../constants/phases.js';
import { DISSONANT_VOICE_EFFECT } from '../constants/effect-types.js';
import { UNICORN } from '../constants/creature-types.js';
import { BARD } from '../constants/creature-classes.js';
import { ACOUSTIC } from '../constants/card-classes.js';
import { UNCOMMON } from '../helpers/probabilities.js';
import { VERY_CHEAP } from '../helpers/costs.js';

/*
 * Aelian (De Animalium Natura, ancient report): of all animals the cartazon has "the most
 * dissonant voice".
 * The card is a rattle, not a silence: no save, no damage, and every opponent's next attack
 * rolls at disadvantage (owner's shape, 2026-09-29). It waits for a card that rolls to hit, so
 * a Blast or a Heal no longer wastes it. It is modest one-on-one and at par in crowds and team
 * battles, which is the card's job. An attack-roll penalty (-2, -4, or with a sting) stayed
 * 5-11 points below the card it replaced. Disadvantage keeps every roll a plain d20, so a
 * natural 1 and a natural 20 keep their meaning (owner rule). The study is
 * docs/archive/studies/2026-09-helm-of-awe-and-dissonant-voice.md.
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

	constructor({ icon = '🔔' }: Partial<CardOptions> = {}) {
		super({ icon } as Partial<CardOptions>);
	}

	get stats(): string {
		return `Every opponent's next attack rolls twice and keeps the worse roll (disadvantage). A card that does not roll to hit (Blast, Heal) leaves it waiting.
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

	static isRattled(target: any): boolean {
		return target.encounterEffects.some((effect: any) => effect.effectType === DISSONANT_VOICE_EFFECT);
	}

	/** Rattles `target` until its next card that rolls to hit, which rolls at disadvantage. */
	rattle(target: any): void {
		const rattled = ({ card, phase, player }: any) => {
			if (phase !== ATTACK_PHASE || player !== target) return card;

			const { getAttackRoll } = card;
			if (typeof getAttackRoll !== 'function') return card;

			target.encounterEffects = target.encounterEffects.filter(
				(effect: any) => effect !== rattled
			);
			this.emit('narration', {
				narration: `${target.givenName}'s ears yet ring with that hideous lowing ${this.icon} (attacks at disadvantage).`,
			});
			// Both rolls go through the card's own getAttackRoll, so its bonuses apply to each; a
			// curse of Loki is the worst roll and a natural 20 the best, whatever the totals. `card`
			// is the per-play clone from applyEffects, so wrapping it never leaks into the deck.
			const rank = (r: any) => (r.curseOfLoki ? -Infinity : r.strokeOfLuck ? Infinity : r.result);
			card.getAttackRoll = (...args: any[]) => {
				const first = getAttackRoll.apply(card, args);
				const second = getAttackRoll.apply(card, args);
				return rank(second) < rank(first) ? second : first;
			};

			return card;
		};

		rattled.effectType = DISSONANT_VOICE_EFFECT;
		target.encounterEffects = [...target.encounterEffects, rattled];
	}

	async effect(player: any, target: any, ring?: any): Promise<boolean> {
		const already = DissonantVoiceCard.isRattled(target);
		if (!already) this.rattle(target);
		this.emit('narration', {
			narration: already
				? `${target.givenName} is already rattled.`
				: `${this.icon} ${target.givenName} is rattled!`,
		});

		// One target per sub-event beat, so a crowded ring does not dump every line in one tick.
		await subEventDelay(ring?.pacingMultiplier);

		return !target.dead;
	}
}

export default DissonantVoiceCard;
