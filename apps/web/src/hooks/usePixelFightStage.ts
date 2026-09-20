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
 * Opt-in pixel-art fight animations in the Ring feed (SNES theme only).
 *
 * Default **off**. The stage shipped on by default for every street-fighter-theme player
 * and turned out to be distracting and to eat too much of the viewport on the phones and
 * tablets this game is mostly played on. Until the presentation is reworked it is
 * something a player asks for, not something that arrives unannounced. The theme feature
 * flag still gates it too: this setting only matters on a theme that has the animations.
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
