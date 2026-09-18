import type { GameEvent } from '@deck-monsters/server/types';

/**
 * Picks the few moments of a fight worth surfacing in the console while the ring feed
 * scrolls past: natural 20s, critical failures, a hit that really landed, a kill, a
 * monster fleeing.
 *
 * The ring feed already shows everything. The point here is *emphasis* — so this stays
 * deliberately stingy. A highlight that fires on every other card is not a highlight, it
 * is a second feed.
 *
 * Classification reads the events' payloads, never their prose. The engine already
 * carries the structured figures (`strokeOfLuck` / `curseOfLoki` on rolls, and, since the
 * change that added this, `damage` / `maxHp` on hits), and matching on text would break
 * the moment anyone rewrote a flavour string.
 */

export type HighlightKind = 'nat20' | 'critFail' | 'bigHit' | 'kill' | 'flee';

export interface FightHighlight {
	kind: HighlightKind;
	/** Short all-caps tag rendered beside the line. */
	label: string;
}

/**
 * A hit is big when it is big **for the monster that threw it** — not relative to whoever
 * it landed on.
 *
 * Measuring against the target's max health was the first attempt and it rewards the
 * wrong thing: a level 6 boss chipping a beginner clears a quarter of their health
 * constantly, while a scrappy beginner landing the best hit of its short life on that
 * boss barely moves the bar. The moment worth calling out is the second one. So the test
 * is against the attacker's own running average this session.
 */
export const BIG_HIT_MULTIPLE = 1.5;

/**
 * An absolute floor, because a ratio alone makes 1 → 2 damage a "150% outlier". Nothing
 * this small is a highlight whatever the attacker usually manages.
 */
export const BIG_HIT_FLOOR = 5;

/**
 * Per-attacker damage seen so far, used to judge a hit against that attacker's own norm.
 *
 * Deliberately session-scoped and in memory: it is a display heuristic, not game state.
 * It starts empty every time the pane mounts, which is correct — the baseline should be
 * what *this viewer* has watched, and a stale cross-session average would make the first
 * hits of a fight judge themselves against monsters long gone.
 */
export interface DamageHistory {
	/** True when `damage` stands out against what this attacker has managed before. */
	isStandout(attacker: string | null, damage: number): boolean;
	record(attacker: string | null, damage: number): void;
}

export function createDamageHistory(): DamageHistory {
	const totals = new Map<string, { hits: number; total: number }>();

	return {
		isStandout(attacker, damage) {
			if (damage < BIG_HIT_FLOOR) return false;
			if (!attacker) return false;
			const seen = totals.get(attacker);
			// The first hit has nothing to be compared against. Staying quiet is better
			// than guessing: a fight only needs one swing before the baseline is real.
			if (!seen || seen.hits === 0) return false;
			return damage >= (seen.total / seen.hits) * BIG_HIT_MULTIPLE;
		},
		record(attacker, damage) {
			if (!attacker || !Number.isFinite(damage) || damage <= 0) return;
			const seen = totals.get(attacker) ?? { hits: 0, total: 0 };
			seen.hits += 1;
			seen.total += damage;
			totals.set(attacker, seen);
		},
	};
}

const LABELS: Record<HighlightKind, string> = {
	nat20: 'NAT 20',
	critFail: 'CRIT FAIL',
	bigHit: 'BIG HIT',
	kill: 'KILL',
	flee: 'FLED',
};

function highlight(kind: HighlightKind): FightHighlight {
	return { kind, label: LABELS[kind] };
}

function asNumber(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function classifyHighlight(
	event: GameEvent,
	history?: DamageHistory,
): FightHighlight | null {
	if (event.type === 'ring.fled') return highlight('flee');
	if (event.type === 'ring.permaDeath') return highlight('kill');

	const payload = (event.payload ?? {}) as Record<string, unknown>;

	// Rolls. `strokeOfLuck` / `curseOfLoki` are the engine's own flags for the two
	// outcomes; the raw natural roll is checked too, because a card can produce a 20 or a
	// 1 without either flag being set.
	const roll = payload.roll as
		| {
			primaryDice?: string;
			strokeOfLuck?: boolean;
			curseOfLoki?: boolean;
			naturalRoll?: { result?: unknown };
		}
		| undefined;
	if (roll) {
		const natural = asNumber(roll.naturalRoll?.result);
		// Only an attack/check d20 has natural-1 / natural-20 semantics. Damage, healing,
		// and other effect rolls carry the same structured `naturalRoll`, so treating their
		// minimum value as a critical failure labels an ordinary `1 on 1d6` as a fumble.
		// The explicit engine flags remain authoritative for cards that opt into crits.
		const isD20 = roll.primaryDice?.replace(/\s/g, '').toLowerCase() === '1d20';
		if (roll.strokeOfLuck === true || (isD20 && natural === 20)) return highlight('nat20');
		if (roll.curseOfLoki === true || (isD20 && natural === 1)) return highlight('critFail');
		return null;
	}

	// Deaths. `announceDeath` is a plain `announce` carrying both an assailant and the
	// `destroyed` flag, which together are unique to it.
	if ('destroyed' in payload && 'assailant' in payload) return highlight('kill');

	const damage = asNumber(payload.damage);
	if (damage !== null) {
		const attacker = typeof payload.assailantName === 'string' ? payload.assailantName : null;
		// Judge before recording, so a hit is never compared against itself.
		const standout = history?.isStandout(attacker, damage) ?? false;
		history?.record(attacker, damage);
		if (standout) return highlight('bigHit');
	}

	return null;
}
