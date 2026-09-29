import type { SerializedGame } from '../types/state-store.js';

const REPLACEMENT = '\uFFFD';
// A NUL, or half of a UTF-16 surrogate pair (text cut in the middle of an emoji). jsonb rejects
// both: `\u0000` outright, and an unpaired surrogate escape as invalid Unicode.
const UNSAVEABLE = /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const needsRepair = (text: string): boolean => {
	UNSAVEABLE.lastIndex = 0;
	return UNSAVEABLE.test(text);
};

/**
 * Replaces every NUL and every unpaired UTF-16 surrogate in every string value and object key
 * with U+FFFD, on a copy.
 *
 * Why: `jsonb` rejects both, so one in a name would fail every save of the room, and because
 * the save is fire-and-forget nobody would notice (roadmap 37). The surrogate case was found
 * when the backfill's own test used one to force a failed write. This is a recursive
 * walk rather than a `JSON.stringify` replacer because a replacer cannot rename keys safely.
 *
 * A repaired key can collide with a key already in the same object (`a�b` next to
 * `a\u0000b`). Silently merging would lose a preset, so the repaired key gets ` (2)`, ` (3)`,
 * ... until it is unique. `repairs` counts the strings and keys changed.
 */
export const repairSerializedGame = (
	state: SerializedGame
): { state: SerializedGame; repairs: number } => {
	let repairs = 0;

	const fixString = (text: string): string => {
		if (!needsRepair(text)) return text;
		repairs += 1;
		return text.replace(UNSAVEABLE, REPLACEMENT);
	};

	const walk = (value: unknown): unknown => {
		if (typeof value === 'string') return fixString(value);
		if (Array.isArray(value)) return value.map(walk);
		if (value !== null && typeof value === 'object') {
			const entries = Object.entries(value as Record<string, unknown>);
			// Keys that need no repair keep their name first, so a repaired key never takes
			// the slot of an untouched one.
			const taken = new Set(entries.map(([key]) => key).filter(key => !needsRepair(key)));
			const result: Record<string, unknown> = {};
			for (const [key, child] of entries) {
				let newKey = fixString(key);
				if (newKey !== key) {
					let n = 2;
					const base = newKey;
					while (taken.has(newKey)) newKey = `${base} (${n++})`;
					taken.add(newKey);
				}
				// defineProperty, not assignment: a key named `__proto__` (presets are keyed by player
				// text) would hit the prototype setter on a plain object and be dropped.
				Object.defineProperty(result, newKey, {
					value: walk(child),
					enumerable: true,
					writable: true,
					configurable: true,
				});
			}
			return result;
		}
		return value;
	};

	return { state: walk(state) as SerializedGame, repairs };
};
