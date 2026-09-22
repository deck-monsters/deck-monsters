import { useCallback, useSyncExternalStore } from 'react';

/**
 * A boolean player preference in `localStorage`, shared live between every component that
 * reads it.
 *
 * Why a shared store rather than `useState(readStored)` per caller: the workspace layout can
 * show a setting's toggle (Account) and the surface it controls (the Ring pane) at the same
 * time. Per-caller state left the pane on the old value until a reload — which is exactly
 * what `useRingKeyTimestamps` did until it moved onto this (roadmap 23's open questions).
 *
 * Storage format, chosen so both existing flags kept their stored values unchanged:
 * - `'1'` on, `'0'` off, absent → `defaultOn`.
 * - Choosing the default *removes* the key; only a departure from it is written. So a
 *   default-off flag writes `'1'` and a default-on flag writes `'0'`.
 *
 * `getSnapshot` re-reads storage rather than caching: the value is a boolean, so
 * `useSyncExternalStore`'s `Object.is` check is satisfied either way, and storage cleared
 * underneath us (a signed-out tab, a test) is picked up instead of masked by a stale cache.
 */
export function createStoredFlag(key: string, defaultOn: boolean) {
	const listeners = new Set<() => void>();

	function read(): boolean {
		if (typeof localStorage === 'undefined') return defaultOn;
		const stored = localStorage.getItem(key);
		if (stored === '1') return true;
		if (stored === '0') return false;
		return defaultOn;
	}

	function notify(): void {
		listeners.forEach((listener) => listener());
	}

	function subscribe(listener: () => void): () => void {
		listeners.add(listener);
		// Keep other tabs in step; a player toggling this on a second tab expects both to agree.
		const onStorage = (event: StorageEvent) => {
			if (event.key === key) notify();
		};
		window.addEventListener('storage', onStorage);
		return () => {
			listeners.delete(listener);
			window.removeEventListener('storage', onStorage);
		};
	}

	function write(next: boolean): void {
		if (next === defaultOn) {
			localStorage.removeItem(key);
		} else {
			localStorage.setItem(key, next ? '1' : '0');
		}
		notify();
	}

	return function useStoredFlag(): [boolean, (next: boolean) => void] {
		const value = useSyncExternalStore(subscribe, read, () => defaultOn);
		const set = useCallback((next: boolean) => write(next), []);
		return [value, set];
	};
}
