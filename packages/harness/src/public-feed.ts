/**
 * Captures **public** RoomEventBus traffic (the ring feed) in order.
 * Private DMs and prompts are not included — use createTestChannel / auto-responder for those.
 */

import type { GameEvent, RoomEventBus } from '@deck-monsters/engine';

export interface PublicFeedCapture {
	/** Monotonic index in capture order (0-based). */
	readonly events: ReadonlyArray<GameEvent & { seq: number }>;
	unsubscribe: () => void;
}

/**
 * Subscribes to the event bus and records every public-scoped event.
 */
export function capturePublicFeed(eventBus: RoomEventBus, subscriberId: string): PublicFeedCapture {
	const events: Array<GameEvent & { seq: number }> = [];
	let seq = 0;

	const unsubscribe = eventBus.subscribe(subscriberId, {
		deliver(event: GameEvent) {
			if (event.scope !== 'public') return;
			events.push(Object.assign(event, { seq: seq++ }));
		},
	});

	return {
		get events() {
			return events;
		},
		unsubscribe,
	};
}

/**
 * Returns full public feed text in capture order (one block per event, separated by blank lines).
 */
export function formatPublicFeedLines(capture: PublicFeedCapture): string {
	return capture.events.map(e => e.text.trim()).filter(Boolean).join('\n\n');
}
