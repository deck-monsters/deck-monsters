import { useCallback, useSyncExternalStore } from 'react';

// The key predates the rename from "pixel fight stage" and is kept so players who opted in
// under the old default keep their choice rather than being silently reset.
const STORAGE_KEY = 'deck-monsters-pixel-fight-stage';

/**
 * Absent means on. Off has to be stored explicitly (`'0'`) now that on is the default.
 *
 * Under the old opt-in default, absent meant off and on was `'1'`. Nobody's "off" was ever
 * written down — it was simply the absence of a choice — so flipping the meaning of absent
 * does not overturn a decision anyone made. Anyone who had opted in still reads `'1'`.
 */
function readStored(): boolean {
	if (typeof localStorage === 'undefined') return true;
	return localStorage.getItem(STORAGE_KEY) !== '0';
}

// The toggle lives in the account view while the sprites it controls live in the Ring
// pane, and the workspace layout can show both at once. A plain useState per caller
// would leave the pane on the old value until a reload, so the stored flag is shared
// through an external store (same approach as useTheme) and every caller re-renders.
//
// getSnapshot re-reads localStorage rather than caching in a module variable: the value
// is a boolean, so useSyncExternalStore's Object.is check is satisfied either way, and
// storage cleared underneath us (a signed-out tab, a test) is picked up instead of being
// masked by a stale cache.
const listeners = new Set<() => void>();

function notify(): void {
	listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	// Keep other tabs in step; a player toggling this on a second tab expects both to agree.
	const onStorage = (event: StorageEvent) => {
		if (event.key === STORAGE_KEY) notify();
	};
	window.addEventListener('storage', onStorage);
	return () => {
		listeners.delete(listener);
		window.removeEventListener('storage', onStorage);
	};
}

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
	const pixelMonstersEnabled = useSyncExternalStore(subscribe, readStored, () => true);

	const setPixelMonstersEnabled = useCallback((next: boolean) => {
		if (next) {
			localStorage.removeItem(STORAGE_KEY);
		} else {
			localStorage.setItem(STORAGE_KEY, '0');
		}
		notify();
	}, []);

	return { pixelMonstersEnabled, setPixelMonstersEnabled };
}
