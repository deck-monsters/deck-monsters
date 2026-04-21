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

/** Result of resolving missed events relative to an in-memory ring buffer cursor. */
export interface EventsSinceResult {
	events: GameEvent[];
	/** `lastEventId` was evicted from the buffer — callers should fall back to durable storage. */
	truncated: boolean;
	/**
	 * Cursor is newer than anything still in the buffer (client already caught up).
	 * When true with an empty `events` array, this is not a truncation miss.
	 */
	upToDate: boolean;
}
