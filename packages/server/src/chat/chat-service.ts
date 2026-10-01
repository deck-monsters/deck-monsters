import { EventEmitter } from 'node:events';

import { stripControlCharacters } from '@deck-monsters/engine';
import { and, asc, desc, eq, gt, inArray, lt, or, sql } from 'drizzle-orm';

import type { Db } from '../db/index.js';
import { profiles, roomMembers, roomMessageReads, roomMessages, rooms } from '../db/schema.js';
import { createLogger } from '../logger.js';
import { publicDisplayName } from '../public-display-name.js';
import type { RoomManager } from '../room-manager.js';

const log = createLogger('chat');

/**
 * Room chat (roadmap 41). Chat is not game state, so it lives here in the server, not the
 * engine, and never goes on the room's game event stream. Every method takes a `roomId` and
 * every query filters on it (docs/architecture/rooms-and-identity.md); callers must have
 * `assertMember`ed first.
 */

export const MAX_MESSAGE_LENGTH = 500;
export const RATE_LIMIT_COUNT = 5;
export const RATE_LIMIT_WINDOW_MS = 10_000;
export const DEFAULT_HISTORY_LIMIT = 100;
export const MAX_HISTORY_LIMIT = 200;

/** Retention (docs/roadmap/41-room-chat.md "Retention"). */
export const RETENTION_MAX_AGE_DAYS = 30;
export const RETENTION_MAX_PER_ROOM = 500;
export const RETENTION_READ_AFTER_DAYS = 7;
export const RETENTION_ACTIVE_WITHIN_DAYS = 14;

export type ChatErrorCode =
	| 'empty'
	| 'too_long'
	| 'rate_limited'
	| 'no_such_player'
	| 'self'
	| 'no_message'
	| 'not_member';

/**
 * Player-facing refusal text, verbatim from the plan (docs/roadmap/41-room-chat.md "The text").
 * The Console and the Chat tab show `error.message` as is.
 */
export const CHAT_ERROR_TEXT: Record<ChatErrorCode, string> = {
	empty: 'Say something after msg, like: msg nice hit, Fang!',
	too_long: 'Messages can be up to 500 characters. That one has {n}.',
	rate_limited: 'Easy there. Wait a few seconds before the next message.',
	no_such_player: 'Nobody in this room goes by that name. Use the name as it shows in Chat, like: dm Ada good luck.',
	self: "That's you. Pick someone else.",
	no_message: 'Add a message after the name, like: dm {name} good luck.',
	// DRAFT(41): not in the plan's text; a non-member never reaches the Chat tab.
	not_member: 'That player is not in this room.',
};

export class ChatError extends Error {
	constructor(
		readonly code: ChatErrorCode,
		vars: { n?: number; name?: string } = {}
	) {
		super(
			CHAT_ERROR_TEXT[code]
				.replace('{n}', String(vars.n ?? ''))
				.replace('{name}', vars.name ?? '')
		);
		this.name = 'ChatError';
	}
}

export type ChatMessage = {
	id: number;
	roomId: string;
	senderUserId: string;
	senderName: string;
	/** null = the whole room. */
	recipientUserId: string | null;
	recipientName: string | null;
	text: string;
	fightNumber: number | null;
	source: string;
	/** ISO 8601. */
	createdAt: string;
};

export type ChatPlayer = { userId: string; name: string };

export type SendInput = {
	roomId: string;
	senderUserId: string;
	text: string;
	toUserId?: string | null;
	source?: string;
};

export type ResolvedRecipient = { userId: string; name: string; message: string };

/** Whether `userId` may see `m`: a room message, or a DM they sent or received. */
export function isVisibleTo(m: { senderUserId: string; recipientUserId: string | null }, userId: string): boolean {
	return m.recipientUserId === null || m.recipientUserId === userId || m.senderUserId === userId;
}

/**
 * Longest-name match for `dm`. `names` maps a candidate name to its player; `rest` must start
 * with the name (case-insensitive) and then end or continue with whitespace, so "Ann" never
 * swallows "Anna's" and "Anthony Bourdain" (with a space) works. Pure, for unit tests.
 */
export function matchRecipient(
	candidates: Array<{ userId: string; name: string; match: string }>,
	rest: string
): { userId: string; name: string; message: string } | null {
	const trimmed = rest.trim();
	const lower = trimmed.toLowerCase();
	let best: { userId: string; name: string; match: string } | null = null;
	for (const c of candidates) {
		const m = c.match.trim().toLowerCase();
		if (!m) continue;
		if (!lower.startsWith(m)) continue;
		const next = trimmed.charAt(m.length);
		if (next !== '' && !/\s/.test(next)) continue;
		if (!best || m.length > best.match.trim().length) best = c;
	}
	if (!best) return null;
	return {
		userId: best.userId,
		name: best.name,
		message: trimmed.slice(best.match.trim().length).trim(),
	};
}

export type ChatListener = (message: ChatMessage) => void;

export class ChatService {
	/**
	 * In-process delivery. One server process only: if this ever runs as more than one
	 * instance, live delivery needs a shared channel (Postgres LISTEN/NOTIFY). History and
	 * unread counts already come from the database, so only the live push is per-process.
	 */
	private readonly emitter = new EventEmitter();
	/** `${roomId}:${userId}` -> send timestamps inside the rate window. */
	private readonly sends = new Map<string, number[]>();

	constructor(
		private readonly db: Db,
		private readonly roomManager: Pick<RoomManager, 'getGame'>,
		private readonly now: () => number = Date.now
	) {
		// One listener per open ringFeed per room; the default cap of 10 would warn spuriously.
		this.emitter.setMaxListeners(0);
	}

	// ── Players and names ────────────────────────────────────────────────────────────────

	/**
	 * Current members with the name other players know them by: the engine character's
	 * `givenName`, else the (email-masked) profile display name. Overridable seam for tests.
	 */
	protected async loadPlayers(roomId: string): Promise<Array<ChatPlayer & { displayName: string }>> {
		const rows = await this.db
			.select({ userId: roomMembers.userId, displayName: profiles.displayName })
			.from(roomMembers)
			.innerJoin(profiles, eq(profiles.id, roomMembers.userId))
			.where(eq(roomMembers.roomId, roomId));
		const characters = await this.characterNames(roomId);
		return rows.map((r) => {
			const displayName = publicDisplayName(r.displayName);
			return { userId: r.userId, name: characters.get(r.userId) ?? displayName, displayName };
		});
	}

	private async characterNames(roomId: string): Promise<Map<string, string>> {
		const out = new Map<string, string>();
		try {
			const game = await this.roomManager.getGame(roomId);
			const characters = (game.characters ?? {}) as Record<string, { givenName?: unknown } | undefined>;
			for (const [userId, c] of Object.entries(characters)) {
				const n = typeof c?.givenName === 'string' ? c.givenName.trim() : '';
				if (n) out.set(userId, n);
			}
		} catch (err) {
			// Names are decoration: fall back to display names rather than refuse to chat.
			log.warn('chat could not read character names', { roomId, err: String(err) });
		}
		return out;
	}

	/** Names for any user ids (a sender may have left the room), keyed by user id. */
	private async namesFor(roomId: string, userIds: string[]): Promise<Map<string, string>> {
		const names = new Map<string, string>();
		if (userIds.length === 0) return names;
		const rows = await this.db
			.select({ id: profiles.id, displayName: profiles.displayName })
			.from(profiles)
			.where(inArray(profiles.id, userIds));
		for (const r of rows) names.set(r.id, publicDisplayName(r.displayName));
		for (const [id, n] of await this.characterNames(roomId)) if (names.has(id)) names.set(id, n);
		return names;
	}

	/** The To picker list: every member except `userId`. */
	async members(roomId: string, userId: string): Promise<ChatPlayer[]> {
		const players = await this.loadPlayers(roomId);
		return players
			.filter((p) => p.userId !== userId)
			.map(({ userId: id, name }) => ({ userId: id, name }))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Splits `rest` ("Anthony Bourdain good luck") into the recipient and the message: the
	 * longest player name `rest` starts with, ignoring case. Both a character name and the
	 * display name match. Returns an error code instead of throwing so `dm`'s caller (M2) can
	 * pick the refusal; `message` may be empty (`no_message`).
	 */
	async resolveRecipient(roomId: string, rest: string): Promise<ResolvedRecipient | { error: 'no_such_player' }> {
		const players = await this.loadPlayers(roomId);
		const candidates = players.flatMap((p) => {
			const out = [{ userId: p.userId, name: p.name, match: p.name }];
			if (p.displayName && p.displayName.toLowerCase() !== p.name.toLowerCase()) {
				out.push({ userId: p.userId, name: p.name, match: p.displayName });
			}
			return out;
		});
		return matchRecipient(candidates, rest) ?? { error: 'no_such_player' };
	}

	// ── Sending ──────────────────────────────────────────────────────────────────────────

	/** Overridable seam for tests: the fight a message sent now belongs to, or null. */
	protected async currentFightNumber(roomId: string): Promise<number | null> {
		const game = await this.roomManager.getGame(roomId);
		if (!game.ring?.inEncounter) return null;
		const rows = await this.db
			.select({ fightCounter: rooms.fightCounter })
			.from(rooms)
			.where(eq(rooms.id, roomId))
			.limit(1);
		// The counter only advances when a fight ends, so the fight now on is counter + 1.
		return (rows[0]?.fightCounter ?? 0) + 1;
	}

	private checkRate(roomId: string, userId: string): void {
		const key = `${roomId}:${userId}`;
		const t = this.now();
		const recent = (this.sends.get(key) ?? []).filter((s) => t - s < RATE_LIMIT_WINDOW_MS);
		if (recent.length >= RATE_LIMIT_COUNT) {
			this.sends.set(key, recent);
			throw new ChatError('rate_limited');
		}
		recent.push(t);
		this.sends.set(key, recent);
	}

	/** Overridable seam for tests. */
	protected async insertMessage(row: {
		roomId: string;
		senderUserId: string;
		recipientUserId: string | null;
		text: string;
		fightNumber: number | null;
		source: string;
	}): Promise<{ id: number; createdAt: Date }> {
		const [inserted] = await this.db
			.insert(roomMessages)
			.values(row)
			.returning({ id: roomMessages.id, createdAt: roomMessages.createdAt });
		return inserted!;
	}

	/**
	 * Validates, stores and delivers a message. Throws `ChatError` with the player-facing text.
	 * The rate limit counts only messages that passed validation, so a refused line costs
	 * nothing. A connector bridging inbound messages calls this with its own `source`.
	 */
	async send(input: SendInput): Promise<ChatMessage> {
		// A NUL is not whitespace and fails the text column, so strip control characters first.
		const text = stripControlCharacters(input.text).trim();
		if (!text) throw new ChatError('empty');
		if (text.length > MAX_MESSAGE_LENGTH) throw new ChatError('too_long', { n: text.length });

		const toUserId = input.toUserId ?? null;
		const players = await this.loadPlayers(input.roomId);
		let recipientName: string | null = null;
		if (toUserId !== null) {
			if (toUserId === input.senderUserId) throw new ChatError('self');
			const recipient = players.find((p) => p.userId === toUserId);
			if (!recipient) throw new ChatError('not_member');
			recipientName = recipient.name;
		}

		this.checkRate(input.roomId, input.senderUserId);

		const fightNumber = await this.currentFightNumber(input.roomId);
		const source = input.source ?? 'web';
		const stored = await this.insertMessage({
			roomId: input.roomId,
			senderUserId: input.senderUserId,
			recipientUserId: toUserId,
			text,
			fightNumber,
			source,
		});
		const message: ChatMessage = {
			id: stored.id,
			roomId: input.roomId,
			senderUserId: input.senderUserId,
			senderName: players.find((p) => p.userId === input.senderUserId)?.name ?? 'Player',
			recipientUserId: toUserId,
			recipientName,
			text,
			fightNumber,
			source,
			createdAt: stored.createdAt.toISOString(),
		};
		this.emitter.emit(input.roomId, message);
		return message;
	}

	// ── Delivery (the bridge seam) ───────────────────────────────────────────────────────

	/**
	 * The bridge seam: `listener` is called with each message sent to `roomId` from now on
	 * that `userId` may see (room messages, and DMs they sent or received). `ringFeed` uses it
	 * to push chat frames; a future Discord bridge would use it to post outward. Returns the
	 * unsubscribe, which must be called when the consumer goes away. Live push only: missed
	 * messages are recovered with `history`.
	 */
	subscribe(roomId: string, userId: string, listener: ChatListener): () => void {
		const handler = (message: ChatMessage) => {
			if (message.roomId !== roomId || !isVisibleTo(message, userId)) return;
			try {
				listener(message);
			} catch (err) {
				log.warn('chat listener threw', { roomId, err: String(err) });
			}
		};
		this.emitter.on(roomId, handler);
		return () => {
			this.emitter.off(roomId, handler);
		};
	}

	// ── History and read position ────────────────────────────────────────────────────────

	private visibleTo(roomId: string, userId: string) {
		return and(
			eq(roomMessages.roomId, roomId),
			or(
				sql`${roomMessages.recipientUserId} is null`,
				eq(roomMessages.recipientUserId, userId),
				eq(roomMessages.senderUserId, userId)
			)
		);
	}

	/**
	 * Messages `userId` may see, ascending by id for display. `afterId` returns the next
	 * `limit` after it (reconnect catch-up); otherwise the newest `limit`, before `beforeId`
	 * when paging back.
	 */
	async history(args: {
		roomId: string;
		userId: string;
		beforeId?: number;
		afterId?: number;
		limit?: number;
	}): Promise<ChatMessage[]> {
		const limit = Math.min(Math.max(1, args.limit ?? DEFAULT_HISTORY_LIMIT), MAX_HISTORY_LIMIT);
		const visible = this.visibleTo(args.roomId, args.userId);
		const cols = {
			id: roomMessages.id,
			senderUserId: roomMessages.senderUserId,
			recipientUserId: roomMessages.recipientUserId,
			text: roomMessages.text,
			fightNumber: roomMessages.fightNumber,
			source: roomMessages.source,
			createdAt: roomMessages.createdAt,
		};
		let rows;
		if (args.afterId !== undefined) {
			rows = await this.db
				.select(cols)
				.from(roomMessages)
				.where(and(visible, gt(roomMessages.id, args.afterId)))
				.orderBy(asc(roomMessages.id))
				.limit(limit);
		} else {
			rows = (
				await this.db
					.select(cols)
					.from(roomMessages)
					.where(and(visible, args.beforeId !== undefined ? lt(roomMessages.id, args.beforeId) : undefined))
					.orderBy(desc(roomMessages.id))
					.limit(limit)
			).reverse();
		}
		const ids = [...new Set(rows.flatMap((r) => (r.recipientUserId ? [r.senderUserId, r.recipientUserId] : [r.senderUserId])))];
		const names = await this.namesFor(args.roomId, ids);
		return rows.map((r) => ({
			id: r.id,
			roomId: args.roomId,
			senderUserId: r.senderUserId,
			senderName: names.get(r.senderUserId) ?? 'Player',
			recipientUserId: r.recipientUserId,
			recipientName: r.recipientUserId ? (names.get(r.recipientUserId) ?? 'Player') : null,
			text: r.text,
			fightNumber: r.fightNumber,
			source: r.source,
			createdAt: r.createdAt.toISOString(),
		}));
	}

	async lastReadId(roomId: string, userId: string): Promise<number> {
		const rows = await this.db
			.select({ lastReadId: roomMessageReads.lastReadId })
			.from(roomMessageReads)
			.where(and(eq(roomMessageReads.roomId, roomId), eq(roomMessageReads.userId, userId)))
			.limit(1);
		return rows[0]?.lastReadId ?? 0;
	}

	/**
	 * Moves the player's read position forward, never back. Capped at the room's newest
	 * message id so a bogus large id cannot mark messages that do not exist yet as read.
	 * Returns the stored position.
	 */
	async markRead(roomId: string, userId: string, lastReadId: number): Promise<number> {
		const newest = await this.db
			.select({ max: sql<number>`coalesce(max(${roomMessages.id}), 0)::int` })
			.from(roomMessages)
			.where(eq(roomMessages.roomId, roomId));
		const target = Math.max(0, Math.min(lastReadId, newest[0]?.max ?? 0));
		const rows = await this.db
			.insert(roomMessageReads)
			.values({ roomId, userId, lastReadId: target })
			.onConflictDoUpdate({
				target: [roomMessageReads.roomId, roomMessageReads.userId],
				set: {
					lastReadId: sql`greatest(${roomMessageReads.lastReadId}, excluded.last_read_id)`,
					updatedAt: sql`now()`,
				},
			})
			.returning({ lastReadId: roomMessageReads.lastReadId });
		return rows[0]?.lastReadId ?? target;
	}

	/** Visible messages after the read position, not counting the player's own. */
	async unreadCount(roomId: string, userId: string): Promise<number> {
		const readId = await this.lastReadId(roomId, userId);
		const rows = await this.db
			.select({ n: sql<number>`count(*)::int` })
			.from(roomMessages)
			.where(
				and(
					this.visibleTo(roomId, userId),
					gt(roomMessages.id, readId),
					sql`${roomMessages.senderUserId} <> ${userId}`
				)
			);
		return rows[0]?.n ?? 0;
	}

	// ── Retention ────────────────────────────────────────────────────────────────────────

	/**
	 * Deletes messages per docs/roadmap/41-room-chat.md "Retention" (set-based, all rooms):
	 * 1. older than 30 days;
	 * 2. beyond the newest 500 in a room;
	 * 3. older than 7 days and read by every member seen within 14 days. A room message waits
	 *    on all such members; a DM only on its recipient (its sender wrote it). A member
	 *    inactive for 14+ days (or never seen) never holds a message back.
	 */
	async sweep(now: Date = new Date()): Promise<{ aged: number; overCap: number; read: number }> {
		const count = (r: unknown): number => (r as { rowCount?: number | null }).rowCount ?? 0;

		const aged = count(
			await this.db.execute(sql`
				delete from room_messages
				where created_at < ${now}::timestamptz - make_interval(days => ${RETENTION_MAX_AGE_DAYS})
			`)
		);
		const overCap = count(
			await this.db.execute(sql`
				delete from room_messages
				where id in (
					select id from (
						select id, row_number() over (partition by room_id order by id desc) as rn
						from room_messages
					) ranked
					where rn > ${RETENTION_MAX_PER_ROOM}
				)
			`)
		);
		const read = count(
			await this.db.execute(sql`
				delete from room_messages m
				where m.created_at < ${now}::timestamptz - make_interval(days => ${RETENTION_READ_AFTER_DAYS})
				and not exists (
					select 1
					from room_members rm
					left join room_message_reads r on r.room_id = rm.room_id and r.user_id = rm.user_id
					where rm.room_id = m.room_id
					and rm.last_seen_at >= ${now}::timestamptz - make_interval(days => ${RETENTION_ACTIVE_WITHIN_DAYS})
					and rm.user_id <> m.sender_user_id
					and (m.recipient_user_id is null or rm.user_id = m.recipient_user_id)
					and coalesce(r.last_read_id, 0) < m.id
				)
			`)
		);
		// Forget rate-limit entries with nothing inside the window so the map cannot grow forever.
		const t = this.now();
		for (const [key, stamps] of this.sends) {
			if (!stamps.some((s) => t - s < RATE_LIMIT_WINDOW_MS)) this.sends.delete(key);
		}
		log.info('chat sweep', { aged, overCap, read });
		return { aged, overCap, read };
	}
}
