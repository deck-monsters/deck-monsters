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

/** A stable, serializable combat participant projection for public event payloads. */
export interface CombatActor {
	name: string;
	creatureType: string;
	icon: string;
	isBoss: boolean;
}

/**
 * Machine-readable combat detail carried beside the existing narration.
 *
 * Consumers must read this public DTO rather than inferring combat outcomes
 * from prose, which can change without a protocol change.
 */
export type CombatPayload =
	| { kind: 'card'; actor: CombatActor; card: { name: string; cardClass?: string } }
	| {
			kind: 'hit';
			actor: CombatActor;
			target: CombatActor;
			damage: number;
			prevHp: number;
			hp: number;
			maxHp: number;
			selfInflicted: boolean;
	  }
	| { kind: 'miss'; actor: CombatActor; target: CombatActor; blocked: boolean }
	| { kind: 'heal'; actor: CombatActor; target: CombatActor; amount: number; hp: number; maxHp: number }
	| { kind: 'death'; target: CombatActor; actor?: CombatActor; destroyed: boolean }
	| { kind: 'flee'; actor: CombatActor };

/**
 * One clean line of the fight feed, carried as `payload.lines` beside `GameEvent.text`.
 *
 * `text` is the Discord-and-pacing contract: fences, ASCII rules, blank lines and
 * indentation are part of it and must not change. `lines` is the same content with that
 * layout removed (every `text` is trimmed, no blank lines, no rules, no fences), each
 * line tagged with the facts a renderer needs to style it or to replace it. Consumers
 * prefer `lines` and fall back to `text`. Plain JSON only: it is persisted to
 * `room_events.payload` and replayed.
 *
 * Inline markup (`*bold*`, `_italic_`, `**bold**`) and icon-cluster spacing stay exactly
 * as they are in `text`; only layout whitespace is gone. A `card` line is the one
 * multi-line exception: its `text` is the frame's inner lines joined by `\n`.
 */
export type FeedLine =
	| { kind: 'narration'; text: string }
	| { kind: 'arrival'; text: string; name: string; boss: boolean; owner?: string }
	| { kind: 'temperament'; text: string }
	| { kind: 'fight-start'; text: string; contestants: number }
	| { kind: 'round'; text: string; round: number }
	| { kind: 'turn'; text: string; round: number; turn: number; actor?: string }
	| {
			kind: 'standing';
			text: string;
			name: string;
			hp: number;
			maxHp: number;
			ac?: number;
			level?: string;
			team?: string;
	  }
	| { kind: 'turn-begin'; text: string; actor: string }
	| { kind: 'play'; text: string; actor: string; card: string }
	| {
			kind: 'roll';
			text: string;
			who: string;
			die: string;
			natural: number;
			bonus: number;
			total: number;
			vs?: number;
			result: 'success' | 'fail' | 'nat20' | 'nat1';
			reason?: string;
	  }
	| { kind: 'verdict'; text: string; total: number; vs?: number; result: 'success' | 'fail' | 'nat20' | 'nat1' }
	| { kind: 'outcome'; text: string }
	| { kind: 'hit'; text: string; assailant: string; target: string; damage: number }
	| { kind: 'hp'; text: string; name: string; hp: number; maxHp: number; bloodied: boolean }
	| { kind: 'miss'; text: string; assailant: string; target: string; blocked: boolean }
	| { kind: 'heal'; text: string; name: string; amount: number; hp: number; maxHp?: number }
	| { kind: 'death'; text: string; name: string; by?: string; destroyed: boolean }
	| { kind: 'flee'; text: string; name: string }
	| { kind: 'win'; text: string; winners: string[] }
	| { kind: 'fight-end'; text: string; deaths: number; rounds: number; isDraw: boolean }
	| {
			kind:
				| 'xp'
				| 'card-drop'
				| 'effect'
				| 'modifier'
				| 'level-up'
				| 'boss-soon'
				| 'ring-event'
				| 'end-of-deck'
				| 'item'
				| 'system';
			text: string;
			[field: string]: string | number | boolean | string[] | undefined;
	  }
	| { kind: 'card'; text: string; title: string; icon?: string };

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
	/**
	 * Trusted server-side observers may opt into every private event in the room.
	 * Connectors and clients must use `userId` instead so private events cannot leak.
	 */
	includePrivate?: boolean;
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
