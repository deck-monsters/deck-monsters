import { createStoredFlag } from './stored-flag.js';

/**
 * Keeps its pre-rename key so explicit stored choices survive. The current contract is
 * absent=on and `'0'`=off; old absent values are indistinguishable from no choice, so the
 * default-on migration necessarily changes behavior for viewers who had relied on absence.
 */
const usePixelMonstersFlag = createStoredFlag('deck-monsters-pixel-fight-stage', true);

/**
 * Pixel-art monster sprites, on every theme. Default **on**; the setting is an opt-out.
 *
 * History, because each step reversed the last: the animations first shipped on by default
 * as a canvas band above the feed, SNES theme only, and were distracting and ate the
 * viewport on the phones and tablets this game is mostly played on (#166), so they went
 * opt-in. Moved into the roster rows they cost no extra height (#167) and, once the row
 * was rebuilt around field priority (#169, #170), were judged good enough to be the
 * default on every theme — see
 * `docs/architecture/ring-roster-and-pixel-monsters.md`. The
 * opt-out remains for anyone who prefers the emoji.
 */
export function usePixelMonsters() {
	const [pixelMonstersEnabled, setPixelMonstersEnabled] = usePixelMonstersFlag();
	return { pixelMonstersEnabled, setPixelMonstersEnabled };
}
