import { useCallback, useState } from 'react';

const STORAGE_KEY = 'deck-monsters-ring-key-timestamps';

function readStored(): boolean {
	if (typeof localStorage === 'undefined') return false;
	return localStorage.getItem(STORAGE_KEY) === '1';
}

/**
 * Optional right-column labels + timeago on key ring events (join/leave/fight).
 * Default off — keeps the feed a single monospace column on small screens.
 */
export function useRingKeyTimestamps() {
	const [ringKeyTimestampsEnabled, setState] = useState(readStored);

	const setRingKeyTimestampsEnabled = useCallback((next: boolean) => {
		if (next) {
			localStorage.setItem(STORAGE_KEY, '1');
		} else {
			localStorage.removeItem(STORAGE_KEY);
		}
		setState(next);
	}, []);

	return { ringKeyTimestampsEnabled, setRingKeyTimestampsEnabled };
}
