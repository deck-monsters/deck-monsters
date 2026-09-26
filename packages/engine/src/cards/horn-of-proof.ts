import { BaseCard, type CardOptions } from './base.js';
import { subEventDelay } from '../helpers/delay-times.js';
import { UNICORN } from '../constants/creature-types.js';
import { CLERIC } from '../constants/creature-classes.js';
import { HEAL } from '../constants/card-classes.js';
import { BAD_BATCH_EFFECT } from '../constants/effect-types.js';
import { RARE } from '../helpers/probabilities.js';
import { CHEAP } from '../helpers/costs.js';

// Fixed and deliberately small: the cleanse is the point, and the heal must stay weaker
// than a dedicated Heal (1d4 + int, which also scales with level).
const HORN_OF_PROOF_HEAL = 3;

// The stats a curse such as Soften pushes below zero for the rest of the fight.
const CURSABLE_STATS = ['ac', 'dex', 'str', 'int'];

/*
 * Ctesias (Indica, ancient report) says those who drink from cups made of the horn are
 * protected from poison and convulsions. That is a claim about a mythical animal, not
 * medicine: the card is a fantasy cleanse, and its copy says what it removes in the game.
 *
 * What it can remove is an explicit list, because the engine has no shared "harmful
 * effect" flag. In priority order, it removes the first one it finds:
 *   1. a hold on the target (any ImmobilizeEffect, including Coil's ongoing damage);
 *   2. the target's harshest negative encounter stat penalty (Soften and similar curses);
 *   3. a Bad Batch waiting in the ring to turn the next drink to poison.
 */
export class HornOfProofCard extends BaseCard {
	static cardClass = [HEAL];
	static cardType = 'Horn of Proof';
	static permittedClassesAndTypes = [UNICORN, CLERIC];
	static probability = RARE.probability;
	static description = 'Dip the horn in the cup. Whatever was wrong with it, is not.';
	static level = 2;
	static cost = CHEAP.cost;

	constructor({ icon = '🏺' }: Partial<CardOptions> = {}) {
		super({ icon } as Partial<CardOptions>);
	}

	get stats(): string {
		return `Remove one of these, in order: a hold on you (immobilize, pin, coil, and the like), your worst stat penalty this fight, or a Bad Batch waiting in the ring.
Then heal ${HORN_OF_PROOF_HEAL} hp.`;
	}

	override getTargets(player: any): any[] {
		return [player];
	}

	cleanseHold(target: any): boolean {
		const held = target.encounterEffects.some(
			(effect: any) => effect.effectType === 'ImmobilizeEffect'
		);
		if (!held) return false;

		target.encounterEffects = target.encounterEffects.filter(
			(effect: any) => effect.effectType !== 'ImmobilizeEffect'
		);
		target.encounterModifiers.immobilizedTurns = 0;
		this.emit('narration', {
			narration: `${this.icon} The horn's touch loosens the hold. ${target.givenName} is free.`,
		});
		return true;
	}

	cleanseCurse(target: any): boolean {
		let worstStat: string | undefined;
		let worstAmount = 0;
		for (const stat of CURSABLE_STATS) {
			const amount = (target.encounterModifiers[stat] as number) || 0;
			if (amount < worstAmount) {
				worstStat = stat;
				worstAmount = amount;
			}
		}
		if (!worstStat) return false;

		this.emit('narration', {
			narration: `${this.icon} The horn draws out the curse on ${target.givenName}'s ${worstStat}.`,
		});
		target.setModifier(worstStat, -worstAmount);
		return true;
	}

	cleanseRing(target: any, ring: any): boolean {
		const effects: any[] = ring?.encounterEffects ?? [];
		if (!effects.some((effect: any) => effect.effectType === BAD_BATCH_EFFECT)) return false;

		ring.encounterEffects = effects.filter(
			(effect: any) => effect.effectType !== BAD_BATCH_EFFECT
		);
		this.emit('narration', {
			narration: `${this.icon} ${target.givenName} dips the horn in every cup in the ring. The bad batch is found out and poured away.`,
		});
		return true;
	}

	async effect(_player: any, target: any, ring?: any): Promise<boolean> {
		const cleansed =
			this.cleanseHold(target) || this.cleanseCurse(target) || this.cleanseRing(target, ring);

		if (!cleansed) {
			this.emit('narration', {
				narration: `${this.icon} The horn finds nothing to purify.`,
			});
		}
		await subEventDelay(ring?.pacingMultiplier);

		return target.heal(HORN_OF_PROOF_HEAL);
	}
}

export default HornOfProofCard;
