import type { SerializedGame } from '../types/state-store.js';

const NUL = '\u0000';
const REPLACEMENT = '�';

/**
 * Replaces every NUL in every string value and object key with U+FFFD, on a copy.
 *
 * Why: `jsonb` rejects `\u0000`, so a NUL in a name would fail every save of the room, and
 * because the save is fire-and-forget nobody would notice (roadmap 37). This is a recursive
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
		if (!text.includes(NUL)) return text;
		repairs += 1;
		return text.split(NUL).join(REPLACEMENT);
	};

	const walk = (value: unknown): unknown => {
		if (typeof value === 'string') return fixString(value);
		if (Array.isArray(value)) return value.map(walk);
		if (value !== null && typeof value === 'object') {
			const entries = Object.entries(value as Record<string, unknown>);
			// Keys that need no repair keep their name first, so a repaired key never takes
			// the slot of an untouched one.
			const taken = new Set(entries.map(([key]) => key).filter(key => !key.includes(NUL)));
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
