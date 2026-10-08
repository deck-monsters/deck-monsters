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
/** One "Label: value" fact from a card's stats or rankings block ("Class: Barbarian"). */
export interface CardFact {
	label: string;
	value: string;
}

/** Result of a dice roll as the card judged it (see `roll` and `verdict`). */
export type RollResult = 'success' | 'fail' | 'nat20' | 'nat1';

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
			/** Omitted when the creature has no numeric hp (never a made-up 0). */
			hp?: number;
			maxHp?: number;
			/** `ac`, `level` and `team` are only present on the turn-begin form, not the turn banner's roster. */
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
			/** Omitted when the roll names no dice. */
			die?: string;
			/** Numeric facts are omitted for opaque/composite or incomplete rolls. */
			natural?: number;
			/** Bonus dice and modifier folded together (the text shows them as two signed numbers). */
			bonus?: number;
			total?: number;
			vs?: number;
			/**
			 * The card's own verdict when it passed one (`success` on the rolled event), else
			 * "total beats vs" (a tie loses) when there is a `vs`, else `success`. Natural 20 and
			 * critical failure take precedence. Damage rolls use `success`; opaque totals without a
			 * card verdict omit `result`.
			 */
			result?: RollResult;
			reason?: string;
	  }
	/** The "🎲 *18 v 12*" line under a roll: the same facts as the roll line, as the line shows them. */
	| { kind: 'verdict'; text: string; total?: number; vs?: number; result?: RollResult }
	| { kind: 'outcome'; text: string }
	| { kind: 'hit'; text: string; assailant?: string; target: string; damage: number }
	| {
			kind: 'hp';
			text: string;
			name: string;
			hp: number;
			maxHp: number;
			/**
			 * Still standing, and at or under half health (not "just crossed the line").
			 * False once hp is 0 or below: that monster has fallen, and "bloodied" would
			 * read as if they were still in the fight.
			 */
			bloodied: boolean;
	  }
	| { kind: 'miss'; text: string; assailant: string; target: string; blocked: boolean }
	| { kind: 'heal'; text: string; name: string; amount: number; hp: number; maxHp?: number }
	| { kind: 'death'; text: string; name: string; by?: string; destroyed: boolean }
	| { kind: 'flee'; text: string; name: string }
	| { kind: 'win'; text: string; winners: string[] }
	| { kind: 'fight-end'; text: string; deaths: number; rounds: number; isDraw: boolean }
	| { kind: 'xp'; text: string; name: string; xp: number; coins?: number; killed?: number }
	| { kind: 'card-drop'; text: string; name: string; card: string }
	| { kind: 'effect'; text: string; target: string; source: string }
	| { kind: 'modifier'; text: string; name: string; attr: string; amount: number; value: number }
	| { kind: 'level-up'; text: string; name: string; level: number }
	| { kind: 'boss-soon'; text: string; delay: number }
	| { kind: 'ring-event'; text: string; id: string; name: string }
	| { kind: 'end-of-deck'; text: string; name: string }
	| { kind: 'item'; text: string; actor: string; target: string }
	/** Bookkeeping and command-flow lines; `name` is the creature it is about, when there is one. */
	| { kind: 'system'; text: string; name?: string; boss?: boolean }
	| {
			kind: 'card';
			/** The frame body: inner lines joined by `\n`, no fences or rules. Fallback for `description`/`stats`. */
			text: string;
			title: string;
			icon?: string;
			/** Unwrapped prose, as authored (the frame hard-wraps at 32 columns; this does not). */
			description?: string;
			stats?: CardFact[];
			rankings?: CardFact[];
			/** A monster's display level, when the frame is a monster's. */
			level?: string;
	  };

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
