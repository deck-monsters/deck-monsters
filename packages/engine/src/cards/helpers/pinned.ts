import { AWE_EFFECT } from '../../constants/effect-types.js';
import { addRollMode } from './roll-mode.js';

/*
 * Pinned monsters are easier to hit (owner idea, roadmap 36): every attack roll against a
 * pinned monster has advantage, as against a restrained creature in D&D. A pinned monster is
 * one held by any `ImmobilizeEffect` (Coil, Constrict, Immobilize, Entrance, Enthrall,
 * Mesmerize, Horn Gore's hold, the Forked Stick and Rod, and Sticketh's stuck horn) or awed by
 * Helm of Awe. Dissonant Voice's rattle is not a pin: the rattled monster still acts.
 *
 * The advantage comes from the pin's own encounter effect. In `DEFENSE_PHASE`, when another
 * monster plays a card, the pin wraps that card's `effect`, so an attack aimed at the pinned
 * monster rolls with advantage for that target only. An area card's other targets roll
 * normally. Faceswap, Blink, and Take Wing wrap cards the same way.
 */

/** A switch for the harness's before/after (`balance/variants.ts`); on in play. */
export const PIN_RULES = { advantage: true };

const PIN_EFFECT_TYPES = ['ImmobilizeEffect', AWE_EFFECT];

export const isPinned = (creature: any): boolean =>
	!!creature?.encounterEffects?.some((effect: any) => PIN_EFFECT_TYPES.includes(effect.effectType));

/**
 * Called by a pin's encounter effect in `DEFENSE_PHASE`: `card` (the per-play clone) rolls
 * its attacks against `pinned` with advantage. `narrate` receives the line to show once the
 * advantage is actually used.
 */
export function advantageAgainstPinned(pinned: any, card: any, narrate?: (line: string) => void): any {
	if (!PIN_RULES.advantage || !card || typeof card.effect !== 'function' || typeof card.getAttackRoll !== 'function') {
		return card;
	}
	// Two pins on one monster (a hold and an awe) still give one advantage.
	if (card.__pinnedAdvantage?.has(pinned)) return card;
	card.__pinnedAdvantage = new Set([...(card.__pinnedAdvantage ?? []), pinned]);

	const { effect } = card;
	card.effect = async function pinnedEffect(this: any, player: any, target: any, ...rest: any[]) {
		if (target !== pinned || player === pinned) return effect.call(this, player, target, ...rest);
		narrate?.(`${pinned.givenName} cannot dodge while pinned (attacks against ${pinned.pronouns?.him ?? 'them'} have advantage).`);
		const undo = addRollMode(card, 'advantage');
		try {
			return await effect.call(this, player, target, ...rest);
		} finally {
			undo();
		}
	};
	return card;
}
