import { createStoredFlag } from './stored-flag.js';

/**
 * Keeps its pre-rename key so players who opted in under the old default keep their choice.
 *
 * Under that old default, absent meant off and on was `'1'`. Nobody's "off" was ever
 * written down — it was simply the absence of a choice — so flipping the meaning of absent
 * does not overturn a decision anyone made, and `'1'` still reads as on.
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
 * default on every theme — see `docs/roadmap/24-pixel-monsters-everywhere.md`. The
 * opt-out remains for anyone who prefers the emoji.
 */
export function usePixelMonsters() {
	const [pixelMonstersEnabled, setPixelMonstersEnabled] = usePixelMonstersFlag();
	return { pixelMonstersEnabled, setPixelMonstersEnabled };
}
