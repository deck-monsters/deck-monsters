import { createStoredFlag } from './stored-flag.js';

const useRingKeyTimestampsFlag = createStoredFlag('deck-monsters-ring-key-timestamps', false);

/**
 * Optional right-column labels + timeago on key ring events (join/leave/fight).
 * Default off — keeps the feed a single monospace column on small screens.
 *
 * This used a plain `useState(readStored)` per caller, so with the workspace layout showing
 * the Account toggle beside the Ring pane, flipping it left the pane unchanged until a
 * reload. It now shares one store with every caller (see `createStoredFlag`).
 */
export function useRingKeyTimestamps() {
	const [ringKeyTimestampsEnabled, setRingKeyTimestampsEnabled] = useRingKeyTimestampsFlag();
	return { ringKeyTimestampsEnabled, setRingKeyTimestampsEnabled };
}
