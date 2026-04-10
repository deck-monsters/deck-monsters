export type EventType =
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
	| 'announce'
	| 'prompt.request'
	| 'prompt.timeout'
	| 'prompt.cancel'
	| 'quick_actions'
	| 'system'
	| 'handshake';

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
