import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'deck-monsters-pixel-fight-stage';

function readStored(): boolean {
	if (typeof localStorage === 'undefined') return false;
	return localStorage.getItem(STORAGE_KEY) === '1';
}

// The toggle lives in the account view while the stage it controls lives in the Ring
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
 * Opt-in pixel-art sprites in the Ring roster (SNES theme only).
 *
 * Default **off**. The animations first shipped on by default, as a canvas band above the
 * feed, and turned out to be distracting and to eat too much of the viewport on the phones
 * and tablets this game is mostly played on. They now live in the roster rows and cost no
 * extra height (#167), but they stay opt-in: a player choosing the SNES palette has not
 * thereby asked for animated monsters. The theme feature flag still gates them too, so
 * this setting only matters on a theme that has the sprites at all.
 */
export function usePixelFightStage() {
	const pixelFightStageEnabled = useSyncExternalStore(subscribe, readStored, () => false);

	const setPixelFightStageEnabled = useCallback((next: boolean) => {
		if (next) {
			localStorage.setItem(STORAGE_KEY, '1');
		} else {
			localStorage.removeItem(STORAGE_KEY);
		}
		notify();
	}, []);

	return { pixelFightStageEnabled, setPixelFightStageEnabled };
}
