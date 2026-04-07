import { randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { eq, and, count, gte, desc } from 'drizzle-orm';

import { Game, RoomEventBus, restoreGame, engineReady } from '@deck-monsters/engine';
import type { Db } from './db/index.js';
import { rooms, roomMembers, profiles, roomEvents } from './db/schema.js';
import type { GameEvent } from '@deck-monsters/engine';
import { PostgresStateStore } from './state-store.js';
import { attachEventPersister } from './event-persister.js';

interface ActiveRoom {
	game: Game;
	eventBus: RoomEventBus;
	lastActivityAt: number;
	unsubscribePersister: () => void;
}

interface EngineDeps {
	Game: typeof Game;
	restoreGame: typeof restoreGame;
}

function generateInviteCode(): string {
	return randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
}

type DbRoomEvent = {
	id: number;
	roomId: string;
	type: string;
	scope: string;
	targetUserId: string | null;
	payload: unknown;
	text: string;
	eventId: string | null;
	createdAt: Date;
};

function dbRowToGameEvent(row: DbRoomEvent): GameEvent {
	return {
		id: row.eventId ?? `hist:${row.id}`,
		roomId: row.roomId,
		timestamp: row.createdAt.getTime(),
		type: row.type as GameEvent['type'],
		scope: row.scope as GameEvent['scope'],
		targetUserId: row.targetUserId ?? undefined,
		payload: (row.payload ?? {}) as Record<string, unknown>,
		text: row.text,
	};
}

export class RoomManager {
	private active = new Map<string, ActiveRoom>();
	private loading = new Map<string, Promise<ActiveRoom>>();

	constructor(
		private readonly db: Db,
		private readonly log: (err: unknown) => void = () => {},
		private readonly deps: EngineDeps = { Game, restoreGame }
	) {}

	async createRoom(
		ownerId: string,
		name: string
	): Promise<{ roomId: string; inviteCode: string }> {
		const roomId = randomUUID();
		const inviteCode = generateInviteCode();

		await this.db.insert(rooms).values({
			id: roomId,
			name,
			ownerId,
			inviteCode,
		});

		await this.db.insert(roomMembers).values({
			roomId,
			userId: ownerId,
			role: 'owner',
		});

		const stateStore = new PostgresStateStore(this.db);
		const game = new this.deps.Game({ roomId }, this.log);
		game.stateStore = stateStore;

		const eventBus = game.eventBus;
		const unsubscribePersister = attachEventPersister(eventBus, this.db, this.log);
		this.active.set(roomId, { game, eventBus, lastActivityAt: Date.now(), unsubscribePersister });

		return { roomId, inviteCode };
	}

	async joinRoom(userId: string, inviteCode: string): Promise<{ roomId: string }> {
		const row = await this.db
			.select({ id: rooms.id })
			.from(rooms)
			.where(eq(rooms.inviteCode, inviteCode))
			.limit(1);

		if (!row[0]) {
			throw new TRPCError({ code: 'NOT_FOUND', message: 'Invalid invite code' });
		}

		const roomId = row[0].id;

		const existing = await this.db
			.select()
			.from(roomMembers)
			.where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
			.limit(1);

		if (!existing[0]) {
			await this.db.insert(roomMembers).values({ roomId, userId, role: 'member' });
		}

		return { roomId };
	}

	async leaveRoom(userId: string, roomId: string): Promise<void> {
		const rows = await this.db
			.select({ ownerId: rooms.ownerId })
			.from(rooms)
			.where(eq(rooms.id, roomId))
			.limit(1);

		if (rows[0]?.ownerId === userId) {
			throw new TRPCError({
				code: 'FORBIDDEN',
				message: 'Owners cannot leave; delete the room or transfer ownership first',
			});
		}

		await this.db
			.delete(roomMembers)
			.where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)));
	}

	async deleteRoom(userId: string, roomId: string): Promise<void> {
		const rows = await this.db
			.select({ ownerId: rooms.ownerId })
			.from(rooms)
			.where(eq(rooms.id, roomId))
			.limit(1);

		if (!rows[0]) {
			throw new TRPCError({ code: 'NOT_FOUND', message: 'Room not found' });
		}

		if (rows[0].ownerId !== userId) {
			throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the room owner can delete it' });
		}

		// Remove from memory first — no state flush needed since the DB row is being deleted.
		this.active.delete(roomId);

		// Cascade deletes room_members and room_events.
		await this.db.delete(rooms).where(eq(rooms.id, roomId));
	}

	async listRoomsForUser(userId: string): Promise<Array<{ roomId: string; name: string; role: string }>> {
		const rows = await this.db
			.select({
				roomId: roomMembers.roomId,
				name: rooms.name,
				role: roomMembers.role,
			})
			.from(roomMembers)
			.innerJoin(rooms, eq(roomMembers.roomId, rooms.id))
			.where(eq(roomMembers.userId, userId));

		return rows;
	}

	async getRoomInfo(
		userId: string,
		roomId: string
	): Promise<{ roomId: string; name: string; inviteCode: string; memberCount: number; role: 'owner' | 'member' } | null> {
		const rows = await this.db
			.select({ id: rooms.id, name: rooms.name, inviteCode: rooms.inviteCode })
			.from(rooms)
			.where(eq(rooms.id, roomId))
			.limit(1);

		if (!rows[0]) {
			throw new TRPCError({ code: 'NOT_FOUND', message: 'Room not found' });
		}

		const [countRows, memberRows] = await Promise.all([
			this.db.select({ value: count() }).from(roomMembers).where(eq(roomMembers.roomId, roomId)),
			this.db
				.select({ role: roomMembers.role })
				.from(roomMembers)
				.where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
				.limit(1),
		]);

		// Non-members get null — callers should throw NOT_FOUND or FORBIDDEN
		if (!memberRows[0]) return null;

		const memberCount = countRows[0]?.value ?? 0;
		const role = memberRows[0].role as 'owner' | 'member';

		return {
			roomId: rows[0].id,
			name: rows[0].name,
			inviteCode: rows[0].inviteCode,
			memberCount,
			role,
		};
	}

	async getRoomMembers(
		roomId: string
	): Promise<Array<{ userId: string; displayName: string; role: string; joinedAt: Date }>> {
		const rows = await this.db
			.select({
				userId: roomMembers.userId,
				displayName: profiles.displayName,
				role: roomMembers.role,
				joinedAt: roomMembers.joinedAt,
			})
			.from(roomMembers)
			.innerJoin(profiles, eq(roomMembers.userId, profiles.id))
			.where(eq(roomMembers.roomId, roomId));

		return rows;
	}

	async assertMember(userId: string, roomId: string): Promise<void> {
		const rows = await this.db
			.select()
			.from(roomMembers)
			.where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
			.limit(1);

		if (!rows[0]) {
			throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member of this room' });
		}
	}

	async getDisplayName(userId: string): Promise<string> {
		const rows = await this.db
			.select({ displayName: profiles.displayName })
			.from(profiles)
			.where(eq(profiles.id, userId))
			.limit(1);

		return rows[0]?.displayName ?? 'Player';
	}

	async getMemberRole(userId: string, roomId: string): Promise<'owner' | 'member'> {
		const rows = await this.db
			.select({ role: roomMembers.role })
			.from(roomMembers)
			.where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
			.limit(1);

		if (!rows[0]) {
			throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member of this room' });
		}

		return rows[0].role as 'owner' | 'member';
	}

	async getGame(roomId: string): Promise<Game> {
		await engineReady;
		const entry = await this._getOrLoad(roomId);
		entry.lastActivityAt = Date.now();
		return entry.game;
	}

	async getEventBus(roomId: string): Promise<RoomEventBus> {
		await engineReady;
		const entry = await this._getOrLoad(roomId);
		entry.lastActivityAt = Date.now();
		return entry.eventBus;
	}

	async resetRoomState(roomId: string): Promise<void> {
		// Quarantine current state, start fresh on next load.
		const rows = await this.db
			.select({ stateBlob: rooms.stateBlob })
			.from(rooms)
			.where(eq(rooms.id, roomId))
			.limit(1);

		if (rows[0]?.stateBlob) {
			await this.db.update(rooms).set({
				stateBlob: null,
				quarantinedBlob: rows[0].stateBlob,
				updatedAt: new Date(),
			}).where(eq(rooms.id, roomId));
		}

		// Evict from active cache so next load starts fresh.
		const entry = this.active.get(roomId);
		if (entry) {
			entry.unsubscribePersister();
			entry.game.dispose();
		}
		this.active.delete(roomId);
	}

	async unloadRoom(roomId: string): Promise<void> {
		const entry = this.active.get(roomId);
		if (entry) {
			// Stop persisting events for this room.
			entry.unsubscribePersister();
			// saveState is a getter returning the bound persist function — call it to flush
			// any state not yet written by the 30s debounce.
			entry.game.saveState();
			// Remove globalSemaphore listeners and stop ring timers so orphaned game
			// instances don't keep firing after the room is evicted from memory.
			entry.game.dispose();
		}
		this.active.delete(roomId);
	}

	async sweepIdleRooms(idleThresholdMs = 2 * 60 * 60 * 1000): Promise<void> {
		const now = Date.now();
		const promises: Promise<void>[] = [];
		for (const [roomId, entry] of this.active) {
			if (now - entry.lastActivityAt > idleThresholdMs) {
				promises.push(this.unloadRoom(roomId));
			}
		}
		await Promise.all(promises);
	}

	async getRingState(
		userId: string,
		roomId: string
	): Promise<{ nextBossSpawnAt: number | null; nextFightAt: number | null; monsterCount: number }> {
		await this.assertMember(userId, roomId);
		const game = await this.getGame(roomId);
		const ring = game.ring;
		return {
			nextBossSpawnAt: ring.nextBossSpawnAt,
			nextFightAt: ring.nextFightAt,
			monsterCount: ring.contestants.length,
		};
	}

	async getRingHistory(userId: string, roomId: string): Promise<GameEvent[]> {
		await this.assertMember(userId, roomId);

		const RING_MAX = 500;
		const MINIMUM = 20;
		const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
		const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

		let rows = await this.db
			.select()
			.from(roomEvents)
			.where(and(eq(roomEvents.roomId, roomId), eq(roomEvents.scope, 'public'), gte(roomEvents.createdAt, cutoff24h)))
			.orderBy(desc(roomEvents.id))
			.limit(RING_MAX);

		if (rows.length < MINIMUM) {
			rows = await this.db
				.select()
				.from(roomEvents)
				.where(and(eq(roomEvents.roomId, roomId), eq(roomEvents.scope, 'public'), gte(roomEvents.createdAt, cutoff7d)))
				.orderBy(desc(roomEvents.id))
				.limit(MINIMUM);
		}

		return rows.reverse().map(dbRowToGameEvent);
	}

	async getConsoleHistory(userId: string, roomId: string): Promise<GameEvent[]> {
		await this.assertMember(userId, roomId);

		const CONSOLE_MAX = 200;
		const MINIMUM = 20;
		const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
		const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

		let rows = await this.db
			.select()
			.from(roomEvents)
			.where(
				and(
					eq(roomEvents.roomId, roomId),
					eq(roomEvents.scope, 'private'),
					eq(roomEvents.targetUserId, userId),
					gte(roomEvents.createdAt, cutoff24h)
				)
			)
			.orderBy(desc(roomEvents.id))
			.limit(CONSOLE_MAX);

		if (rows.length < MINIMUM) {
			rows = await this.db
				.select()
				.from(roomEvents)
				.where(
					and(
						eq(roomEvents.roomId, roomId),
						eq(roomEvents.scope, 'private'),
						eq(roomEvents.targetUserId, userId),
						gte(roomEvents.createdAt, cutoff7d)
					)
				)
				.orderBy(desc(roomEvents.id))
				.limit(MINIMUM);
		}

		return rows.reverse().map(dbRowToGameEvent);
	}

	private _getOrLoad(roomId: string): Promise<ActiveRoom> {
		const cached = this.active.get(roomId);
		if (cached) return Promise.resolve(cached);

		const inflight = this.loading.get(roomId);
		if (inflight) return inflight;

		const promise = this._loadRoom(roomId).finally(() => {
			this.loading.delete(roomId);
		});
		this.loading.set(roomId, promise);
		return promise;
	}

	private async _loadRoom(roomId: string): Promise<ActiveRoom> {
		// Re-check the cache in case it was populated while we were waiting
		const cached = this.active.get(roomId);
		if (cached) return cached;

		const rows = await this.db
			.select({ stateBlob: rooms.stateBlob })
			.from(rooms)
			.where(eq(rooms.id, roomId))
			.limit(1);

		if (!rows[0]) {
			throw new TRPCError({ code: 'NOT_FOUND', message: 'Room not found' });
		}

		const stateStore = new PostgresStateStore(this.db);
		let game: Game;

		if (rows[0].stateBlob) {
			try {
				game = this.deps.restoreGame(rows[0].stateBlob, this.log);
				(game.options as Record<string, unknown>).roomId = roomId;
			} catch (err) {
				// Hydration failed — quarantine the bad blob so it can be inspected,
				// then start a fresh game so the room is usable again immediately.
				this.log(err);
				await this.db.update(rooms).set({
					stateBlob: null,
					quarantinedBlob: rows[0].stateBlob,
					updatedAt: new Date(),
				}).where(eq(rooms.id, roomId));
				game = new this.deps.Game({ roomId }, this.log);
			}
		} else {
			game = new this.deps.Game({ roomId }, this.log);
		}

		game.stateStore = stateStore;

		const eventBus = game.eventBus;
		const unsubscribePersister = attachEventPersister(eventBus, this.db, this.log);
		const entry: ActiveRoom = { game, eventBus, lastActivityAt: Date.now(), unsubscribePersister };
		this.active.set(roomId, entry);
		return entry;
	}
}
