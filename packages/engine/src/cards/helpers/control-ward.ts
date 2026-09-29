import { ATTACK_PHASE } from '../../constants/phases.js';
import { UNICORN } from '../../constants/creature-types.js';

/**
 * Unconquerable Horn's once-per-fight ward, generalized (roadmap 35, "Unconquerable Horn as
 * a counterspell", owner 2026-09-28) from a hold-only block into a one-round counterspell: it
 * cancels the next negative, non-damage effect an opponent puts on its warder, then is spent.
 * It lives in `encounterModifiers`, which `endEncounter()` deletes, so it never outlives the
 * fight and is never serialized.
 *
 * "Negative, non-damage effect" is defined by the engine rather than by card names or
 * narration, through one entry point, `wardAgainst()`. Every hold an opponent applies
 * (Immobilize, Horn Gore, Coil, Constrict, Entrance, Enthrall, Mesmerize, Forked Stick,
 * Forked Metal Rod) still goes through `ImmobilizeCard.immobilize()`, which now calls
 * `wardAgainst()` too. The curse part of Soften/Molasses/Concussion/Brain Drain
 * (`CurseCard.applyCurse`), Blink's time-shift, Bad Batch's poison, Sandstorm's confusion,
 * and Enchanted Faceswap's redirect call it directly. Damage is never touched: only the
 * warded card's extra effect is cancelled, and Curse of Loki (a natural 1 turning an
 * attacker's own blow back) is a roll outcome aimed at nobody, so it is never warded. A new
 * negative non-damage effect that bypasses all of the above is not warded until it calls
 * `wardAgainst` (or `consumeControlWard`) itself.
 *
 * Duration: one round. Arming attaches a counting `encounterEffects` entry to the warder
 * (see `fire-breath.ts` `wind()` for the same ATTACK_PHASE-keyed-to-one-monster pattern) that
 * ticks down once per card the warder itself plays; if the ward has not fired by the time the
 * warder has played a full hand's worth of further cards (`monster.cardSlots`, 9 by default —
 * the same point next round), it lapses. A lapsed ward counts as used: it does not re-arm
 * this fight, same as a spent one.
 */
export const CONTROL_WARD = 'unconquerableWard';

const CONTROL_WARD_LAPSE_EFFECT = 'ControlWardLapseEffect';

export type ControlWardState = 'armed' | 'spent' | 'lapsed';

export type WardNarrator = (event: string, payload: { narration: string }) => void;

export const getControlWard = (creature: any): ControlWardState | undefined =>
	creature?.encounterModifiers?.[CONTROL_WARD];

const removeLapseTimer = (creature: any): void => {
	if (!creature?.encounterEffects) return;
	creature.encounterEffects = creature.encounterEffects.filter(
		(effect: any) => effect.effectType !== CONTROL_WARD_LAPSE_EFFECT
	);
};

/**
 * Attaches the one-round countdown. `cardsRemaining` starts at the warder's hand size and
 * ticks down once per card the warder itself plays (`phase === ATTACK_PHASE` for its own
 * encounter effect, the same test `fire-breath.ts`'s `wind()` uses); reaching zero without
 * firing lapses the ward. `emit`, captured at arm time, is how the lapse can still narrate
 * itself from inside a later, unrelated card's `applyEffects()` pass.
 */
const armLapseTimer = (creature: any, emit?: WardNarrator): void => {
	removeLapseTimer(creature);
	let cardsRemaining = creature.cardSlots || 9;

	const lapse = ({ card, phase, player: effectPlayer }: any) => {
		if (phase !== ATTACK_PHASE || effectPlayer !== creature) return card;

		cardsRemaining -= 1;
		if (cardsRemaining <= 0) {
			removeLapseTimer(creature);
			if (getControlWard(creature) === 'armed') {
				creature.encounterModifiers[CONTROL_WARD] = 'lapsed';
				emit?.('narration', {
					narration: `${creature.givenName}'s ward fades unspent, the round having passed.`,
				});
			}
		}
		return card;
	};

	lapse.effectType = CONTROL_WARD_LAPSE_EFFECT;
	creature.encounterEffects = [...creature.encounterEffects, lapse];
};

/**
 * Arms the ward unless it is already armed or was spent or lapsed earlier in this fight.
 * `emit`, when given, is threaded to the lapse timer so a lapse (which fires later, out from
 * under whichever card armed the ward) can still narrate itself.
 */
export const armControlWard = (
	creature: any,
	emit?: WardNarrator
): 'armed' | 'already-armed' | 'spent' => {
	const state = getControlWard(creature);
	if (state === 'armed') return 'already-armed';
	if (state === 'spent' || state === 'lapsed') return 'spent';
	creature.encounterModifiers[CONTROL_WARD] = 'armed';
	armLapseTimer(creature, emit);
	return 'armed';
};

// Same precedence the ring's `factionOf` and `getTarget`'s `teamOf` use: a ring event's
// contestant-level team, then the monster's, then the character's.
const teamOf = (contestant: any): string | undefined =>
	contestant?.team || contestant?.monster?.team || contestant?.character?.team;

/**
 * Whether `holder` is an opponent of `held` for ward purposes. Area holds such as Mesmerize
 * deliberately catch allies too, and the ward only promises to refuse an opponent's effect,
 * so a teammate's effect must not spend it. Without contestant data (direct card calls in
 * tests), or under a free-for-all ring event such as Blood Feud, everyone is an opponent.
 */
export const isOpponentHold = (holder: any, held: any, activeContestants?: any[], ring?: any): boolean => {
	if (holder === held) return false;
	if (!activeContestants || ring?.encounterFreeForAll) return true;
	const holderTeam = teamOf(activeContestants.find(({ monster }: any) => monster === holder));
	const heldTeam = teamOf(activeContestants.find(({ monster }: any) => monster === held));
	return !holderTeam || holderTeam !== heldTeam;
};

/** Spends an armed ward. Returns true when a control effect should be cancelled. */
export const consumeControlWard = (creature: any): boolean => {
	if (getControlWard(creature) !== 'armed') return false;
	creature.encounterModifiers[CONTROL_WARD] = 'spent';
	removeLapseTimer(creature);
	return true;
};

/**
 * The single entry point every negative, non-damage effect should call before it lands:
 * returns true (and spends the ward) when `target` has an armed ward and `source` is an
 * opponent per `isOpponentHold` (same team rules; a creature never spends its ward on itself,
 * and an ally's effect never spends it). Callers still land any damage that comes with the
 * effect; only the non-damage part is cancelled when this returns true.
 */
export const wardAgainst = (
	target: any,
	source: any,
	{ activeContestants, ring }: { activeContestants?: any[]; ring?: any } = {}
): boolean =>
	isOpponentHold(source, target, activeContestants, ring) && consumeControlWard(target);

/**
 * The refusal line, generalized from the hold line in `immobilize.ts`: the Job 39:9 quote
 * only for a Unicorn (confusion can lend the ward to any creature), naming what was refused
 * in plain words. `refusal` is a full sentence, e.g. "will not be cursed."
 */
export const controlWardNarration = (target: any, refusal: string): string =>
	`${target.creatureType === UNICORN ? '"Will the unicorn be willing to serve thee?" ' : ''}${target.givenName} ${refusal} The Unconquerable Horn's ward is spent.`;
