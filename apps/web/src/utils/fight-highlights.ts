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
 * A hit counts as big at a quarter of the target's maximum health. Significance has to be
 * a ratio: 9 damage is a scratch on a 53hp boss and nearly half of a beginner. The floor
 * stops a tiny-maxHp edge case from making routine chip damage look dramatic.
 */
export const BIG_HIT_RATIO = 0.25;
export const BIG_HIT_FLOOR = 5;

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

export function isBigHit(damage: number | null, maxHp: number | null): boolean {
	if (damage === null || damage <= 0) return false;
	if (maxHp === null || maxHp <= 0) return damage >= BIG_HIT_FLOOR;
	return damage >= Math.max(BIG_HIT_FLOOR, maxHp * BIG_HIT_RATIO);
}

export function classifyHighlight(event: GameEvent): FightHighlight | null {
	if (event.type === 'ring.fled') return highlight('flee');
	if (event.type === 'ring.permaDeath') return highlight('kill');

	const payload = (event.payload ?? {}) as Record<string, unknown>;

	// Rolls. `strokeOfLuck` / `curseOfLoki` are the engine's own flags for the two
	// outcomes; the raw natural roll is checked too, because a card can produce a 20 or a
	// 1 without either flag being set.
	const roll = payload.roll as
		| { strokeOfLuck?: boolean; curseOfLoki?: boolean; naturalRoll?: { result?: unknown } }
		| undefined;
	if (roll) {
		const natural = asNumber(roll.naturalRoll?.result);
		if (roll.strokeOfLuck === true || natural === 20) return highlight('nat20');
		if (roll.curseOfLoki === true || natural === 1) return highlight('critFail');
		return null;
	}

	// Deaths. `announceDeath` is a plain `announce` carrying both an assailant and the
	// `destroyed` flag, which together are unique to it.
	if ('destroyed' in payload && 'assailant' in payload) return highlight('kill');

	if (isBigHit(asNumber(payload.damage), asNumber(payload.maxHp))) return highlight('bigHit');

	return null;
}
