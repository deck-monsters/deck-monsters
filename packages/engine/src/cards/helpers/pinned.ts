import { AWE_EFFECT } from '../../constants/effect-types.js';
import { addRollMode, hasRollModeAgainst } from './roll-mode.js';

/*
 * Pinned monsters are easier to hit (owner idea, roadmap 36): every attack roll against a
 * pinned monster has advantage, as against a restrained creature in D&D. A pinned monster is
 * one held by any `ImmobilizeEffect` (Coil, Constrict, Immobilize, Entrance, Enthrall,
 * Mesmerize, Horn Gore's hold, the Forked Stick and Rod, and Sticketh's stuck horn) or awed by
 * Helm of Awe. Dissonant Voice's rattle is not a pin: the rattled monster still acts.
 *
 * The advantage comes from the pin's own encounter effect. In `DEFENSE_PHASE`, when another
 * monster plays a card, the pin gives that card's attack rolls advantage against the pinned
 * monster only. An area card's other targets roll normally. `roll-mode.ts` decides at each
 * roll who is being attacked, which also covers cards that choose their victims inside their
 * own effect (Enthrall) and strikes that roll their own d20 (the donkey's kick, the tail).
 */

/** A switch for the harness's before/after (`balance/variants.ts`); on in play. */
export const PIN_RULES = { advantage: true };

const PIN_EFFECT_TYPES = ['ImmobilizeEffect', AWE_EFFECT];

export const isPinned = (creature: any): boolean =>
	!!creature?.encounterEffects?.some((effect: any) => PIN_EFFECT_TYPES.includes(effect.effectType));

/**
 * Called by a pin's encounter effect in `DEFENSE_PHASE`: `card` (the per-play clone) rolls
 * its attacks against `pinned` with advantage. `narrate` receives the line to show, once, the
 * first time the advantage applies to a roll.
 */
export function advantageAgainstPinned(pinned: any, card: any, narrate?: (line: string) => void): any {
	if (!PIN_RULES.advantage || !card) return card;
	// Two pins on one monster (a hold and an awe) still give one advantage.
	if (hasRollModeAgainst(card, 'advantage', pinned)) return card;

	let told = false;
	addRollMode(card, 'advantage', {
		against: pinned,
		onApply: () => {
			if (told) return;
			told = true;
			narrate?.(`${pinned.givenName} cannot dodge while pinned (attacks against ${pinned.pronouns?.him ?? 'them'} have advantage).`);
		},
	});
	return card;
}
