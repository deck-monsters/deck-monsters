export type EventType =
	| 'system.gap'
	| 'ring.add'
	| 'ring.remove'
	| 'ring.clear'
	| 'ring.countdown'
	| 'ring.fight'
	| 'ring.fightResolved'
	| 'ring.win'
	| 'ring.loss'
	| 'ring.draw'
	| 'ring.fled'
	| 'ring.permaDeath'
	| 'ring.xp'
	| 'ring.cardDrop'
	| 'ring.state'
	| 'card.played'
	| 'card.equipped'
	| 'card.presetLoaded'
	| 'announce'
	| 'prompt.request'
	| 'prompt.timeout'
	| 'prompt.cancel'
	| 'quick_actions'
	| 'system'
	| 'handshake'
	| 'heartbeat';

export type EventScope = 'public' | 'private';

export interface GameEvent {
	id: string;
	roomId: string;
	timestamp: number;
	type: EventType;
	scope: EventScope;
	targetUserId?: string;
	payload: Record<string, unknown>;
	text: string;
	/** Protocol version of the server that emitted this event (set on handshake events). */
	protocolVersion?: number;
	/** The commandId that triggered this event, for client-side correlation. */
	causedByCommandId?: string;
}

export interface EventSubscriber {
	userId?: string;
	deliver: (event: GameEvent) => void;
}

/**
 * How a replay cursor resolved against the in-memory ring buffer.
 *
 * - `found`   — cursor is in the buffer; `events` holds everything after it.
 * - `ahead`   — cursor is newer than the buffer tail; the client is caught up.
 * - `evicted` — cursor fell out of the 200-event buffer while the room stayed
 *               loaded. Real events almost certainly happened in the gap, so an
 *               empty durable-storage result should be surfaced to the user.
 * - `cold`    — the buffer is empty because the room was (re)loaded from scratch
 *               after a server restart or idle eviction. Durable storage is the
 *               only source of truth; an empty result there is the normal case
 *               (the room was idle) and must NOT be reported as a gap.
 */
export type EventsSinceStatus = 'found' | 'ahead' | 'evicted' | 'cold';

/** Result of resolving missed events relative to an in-memory ring buffer cursor. */
export interface EventsSinceResult {
	events: GameEvent[];
	/** Cursor is unresolvable from memory — callers MUST fall back to durable storage. */
	truncated: boolean;
	/**
	 * Cursor is newer than anything still in the buffer (client already caught up).
	 * When true with an empty `events` array, this is not a truncation miss.
	 */
	upToDate: boolean;
	/** Precise reason, for deciding whether an empty replay is worth warning about. */
	status: EventsSinceStatus;
}
