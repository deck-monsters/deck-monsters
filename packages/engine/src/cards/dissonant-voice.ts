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
 * Aelian (On Animals XVI.20, ancient report) gives the cartazon a harsh, dissonant voice.
 * The card is a rattle, not a silence: one small penalty on one attack, no damage.
 */
export class DissonantVoiceCard extends BaseCard {
	static cardClass = [ACOUSTIC];
	static cardType = 'Dissonant Voice';
	static permittedClassesAndTypes = [UNICORN, BARD];
	static probability = UNCOMMON.probability;
	static description = 'A cry that no throat that shape should make. It is hard to aim while it rings.';
	static level = 1;
	static cost = VERY_CHEAP.cost;

	constructor({ icon = '🔔' }: Partial<CardOptions> = {}) {
		super({ icon } as Partial<CardOptions>);
	}

	get stats(): string {
		return `Each opponent rolls 1d20 + int vs your int. On a failure, ${DISSONANCE_PENALTY} is taken off their next attack roll.
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
		const rattled = ({ card, phase, player }: any) => {
			if (phase !== ATTACK_PHASE || player !== target) return card;

			// Spent on the next card, whether or not it attacks: a one-play penalty.
			target.encounterEffects = target.encounterEffects.filter(
				(effect: any) => effect !== rattled
			);

			const { getAttackRoll } = card;
			if (typeof getAttackRoll === 'function') {
				this.emit('narration', {
					narration: `${target.givenName}'s ears still ring ${this.icon} (-${DISSONANCE_PENALTY} to attack).`,
				});
				// `card` is the per-play clone from applyEffects, so wrapping it never leaks
				// into the deck.
				card.getAttackRoll = (...args: any[]) => {
					const attackRoll = getAttackRoll.apply(card, args);
					attackRoll.modifier -= DISSONANCE_PENALTY;
					attackRoll.result = Math.max(attackRoll.result - DISSONANCE_PENALTY, 0);
					return attackRoll;
				};
			}

			return card;
		};

		rattled.effectType = DISSONANT_VOICE_EFFECT;
		target.encounterEffects = [...target.encounterEffects, rattled];
	}

	async effect(player: any, target: any, ring?: any): Promise<boolean> {
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

		if (!success && !alreadyRattled) this.rattle(target);

		// One save per sub-event beat, so a crowded ring does not dump every roll in one tick.
		await subEventDelay(ring?.pacingMultiplier);

		return !target.dead;
	}
}

export default DissonantVoiceCard;
