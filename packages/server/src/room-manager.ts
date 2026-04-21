import { randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { eq, and, count, gte, desc, gt, or, asc } from 'drizzle-orm';
import { createLogger } from './logger.js';

const log = createLogger('room-manager');

import {
	Game,
	RoomEventBus,
	restoreGame,
	engineReady,
	getHydratorStatus,
	createKeyedPromiseQueue,
	type LeaderboardSortKey,
} from '@deck-monsters/engine';
import type { Db } from './db/index.js';
import { rooms, roomMembers, profiles, roomEvents, roomPlayerStats, roomMonsterStats, fightSummaries } from './db/schema.js';
import { dbRowToGameEvent } from './db/game-event-map.js';
import type { GameEvent } from '@deck-monsters/engine';
import { PostgresStateStore } from './state-store.js';
import { attachEventPersister } from './event-persister.js';
import { attachFightStatsSubscriber } from './fight-stats-subscriber.js';
import { attachFightSummaryWriter } from './fight-summary-writer.js';
import {
	buildCatchUpText,
	computeMonsterWinStreaks,
	formatCatchUpStreakLines,
	formatGlobalMonsterLeaderboard,
	formatGlobalPlayerLeaderboard,
	formatRoomMonsterLeaderboard,
	formatRoomPlayerLeaderboard,
	formatSinceLabel,
	getMemberLastSeen,
	monsterIdsFromSummaries,
	queryFightsSince,
	queryGlobalMonsters,
	queryGlobalPlayers,
	queryRoomMonsters,
	queryRoomPlayers,
	STREAK_MIN,
	touchMemberLastSeen,
	type LeaderboardSort,
} from './analytics-queries.js';
import { attachMetricsCollector } from './metrics/collector.js';
import { attachDebugEventLogger } from './debug-event-logger.js';
import {
	roomsCreated,
	roomsActive,
	roomHydrationFailures,
	roomHydrationWarnings,
	cardErrors,
	cardValidationWarnings,
	fightErrors,
} from './metrics/index.js';

interface ActiveRoom {
	game: Game;
	eventBus: RoomEventBus;
	lastActivityAt: number;
	unsubscribePersister: () => void;
	unsubscribeMetrics: () => void;
	unsubscribeFightStats: () => void;
	unsubscribeFightSummary: () => void;
	unsubscribeDebugLogger: () => void;
}

interface EngineDeps {
	Game: typeof Game;
	restoreGame: typeof restoreGame;
}

function generateInviteCode(): string {
	return randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
}

export class RoomManager {
	private active = new Map<string, ActiveRoom>();
	private loading = new Map<string, Promise<ActiveRoom>>();
	/** One in-flight engine command chain per room — prevents interleaved game state / ring feed. */
	private readonly runEngineCommand = createKeyedPromiseQueue();

	constructor(
		private readonly db: Db,
		private readonly log: (err: unknown) => void = () => {},
		private readonly deps: EngineDeps = { Game, restoreGame }
	) {}

	/**
	 * Returns a log callback scoped to a room that increments the relevant
	 * error counter before delegating to the base logger.
	 */
	private _attachGameAnalytics(roomId: string, game: Game): void {
		game.analytics = {
			fetchRoomPlayerLeaderboard: async (sortBy: LeaderboardSortKey, limit: number) => {
				const rows = await queryRoomPlayers(this.db, roomId, sortBy as LeaderboardSort, limit);
				return formatRoomPlayerLeaderboard(`Top ${limit} Players`, rows);
			},
			fetchRoomMonsterLeaderboard: async (sortBy: LeaderboardSortKey, limit: number) => {
				const rows = await queryRoomMonsters(this.db, roomId, sortBy as LeaderboardSort, limit);
				const streaks = await computeMonsterWinStreaks(
					this.db,
					roomId,
					rows.map((r) => r.monsterId)
				);
				return formatRoomMonsterLeaderboard(`Top ${limit} Monsters`, rows, streaks);
			},
			fetchGlobalPlayerLeaderboard: async (sortBy: LeaderboardSortKey, limit: number) => {
				const rows = await queryGlobalPlayers(this.db, sortBy as LeaderboardSort, limit);
				return formatGlobalPlayerLeaderboard(`Top ${limit} Players (global)`, rows);
			},
			fetchGlobalMonsterLeaderboard: async (sortBy: LeaderboardSortKey, limit: number) => {
				const rows = await queryGlobalMonsters(this.db, sortBy as LeaderboardSort, limit);
				return formatGlobalMonsterLeaderboard(`Top ${limit} Monsters (global)`, rows);
			},
			catchUp: async (userId: string, since: Date | null) => {
				let sinceDate = since;
				if (!sinceDate) {
					const ls = await getMemberLastSeen(this.db, roomId, userId);
					sinceDate = ls ?? new Date(Date.now() - 60 * 60 * 1000);
				}
				const summaries = await queryFightsSince(this.db, roomId, sinceDate);
				const label = formatSinceLabel(sinceDate);
				const ids = monsterIdsFromSummaries(summaries);
				const streakMap = await computeMonsterWinStreaks(this.db, roomId, ids, STREAK_MIN);
				const streakLines = formatCatchUpStreakLines(streakMap, summaries);
				const { textSummary } = buildCatchUpText(summaries, label, streakLines);
				await touchMemberLastSeen(this.db, roomId, userId);
				return textSummary;
			},
		};
	}

	private _makeRoomLogger(roomId: string): (err: unknown) => void {
		return (err: unknown) => {
			const ctx = (err as Record<string, unknown> | null)?.context;
			if (ctx === 'ring.fight.invalidCard') cardErrors.inc({ room_id: roomId });
			else if (ctx === 'ring.addMonster.cardValidation') cardValidationWarnings.inc({ room_id: roomId });
			else if (ctx === 'ring.fight') fightErrors.inc({ room_id: roomId });
			this.log(err);
		};
	}

	async createRoom(
		ownerId: string,
		name: string
	): Promise<{ roomId: string; inviteCode: string }> {
		const roomId = randomUUID();
		const inviteCode = generateInviteCode();

		log.debug('creating room', { roomId, name, ownerId });

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
		const roomLog = this._makeRoomLogger(roomId);
		const game = new this.deps.Game({ roomId }, roomLog);
		game.stateStore = stateStore;

		const eventBus = game.eventBus;
		const unsubscribePersister = attachEventPersister(eventBus, this.db, this.log);
		const unsubscribeMetrics = attachMetricsCollector(eventBus, game.ring, roomId);
		const unsubscribeFightStats = attachFightStatsSubscriber(eventBus, this.db, this.log);
		const unsubscribeFightSummary = attachFightSummaryWriter(eventBus, this.db, this.log);
		const unsubscribeDebugLogger = attachDebugEventLogger(eventBus, game.ring, roomId);
		this._attachGameAnalytics(roomId, game);
		this.active.set(roomId, {
			game,
			eventBus,
			lastActivityAt: Date.now(),
			unsubscribePersister,
			unsubscribeMetrics,
			unsubscribeFightStats,
			unsubscribeFightSummary,
			unsubscribeDebugLogger,
		});
		roomsCreated.inc();
		roomsActive.set(this.active.size);

		log.info('room created', { roomId, name, ownerId, inviteCode });
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

		log.info('deleting room', { roomId, requestedBy: userId, wasActive: this.active.has(roomId) });

		// Remove from memory first — no state flush needed since the DB row is being deleted.
		const activeEntry = this.active.get(roomId);
		if (activeEntry) {
			activeEntry.unsubscribePersister();
			activeEntry.unsubscribeMetrics();
			activeEntry.unsubscribeFightStats();
			activeEntry.unsubscribeFightSummary();
			activeEntry.unsubscribeDebugLogger();
		}
		this.active.delete(roomId);
		roomsActive.set(this.active.size);

		// Cascade deletes room_members and room_events.
		await this.db.delete(rooms).where(eq(rooms.id, roomId));
		log.debug('room deleted from DB', { roomId });
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
	): Promise<{
		roomId: string;
		name: string;
		inviteCode: string;
		memberCount: number;
		role: 'owner' | 'member';
		lastSeenAt: Date | null;
	} | null> {
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
				.select({ role: roomMembers.role, lastSeenAt: roomMembers.lastSeenAt })
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
			lastSeenAt: memberRows[0].lastSeenAt ?? null,
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

	/**
	 * Runs engine work for a room **one chain at a time**. All `game.command` actions
	 * must use this so two users cannot interleave `handleCommand` / ring combat on
	 * the same `Game` instance.
	 */
	runSerializedEngineWork<T>(roomId: string, fn: () => Promise<T>): Promise<T> {
		return this.runEngineCommand(roomId, fn);
	}

	async resetRoomState(roomId: string): Promise<void> {
		await this.db.delete(roomPlayerStats).where(eq(roomPlayerStats.roomId, roomId));
		await this.db.delete(roomMonsterStats).where(eq(roomMonsterStats.roomId, roomId));
		await this.db.delete(fightSummaries).where(eq(fightSummaries.roomId, roomId));
		await this.db.update(rooms).set({ fightCounter: 0, updatedAt: new Date() }).where(eq(rooms.id, roomId));

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
			entry.unsubscribeMetrics();
			entry.unsubscribeFightStats();
			entry.unsubscribeFightSummary();
			entry.unsubscribeDebugLogger();
			entry.game.dispose();
		}
		this.active.delete(roomId);
		roomsActive.set(this.active.size);
	}

	async unloadRoom(roomId: string): Promise<void> {
		const entry = this.active.get(roomId);
		if (entry) {
			log.debug('unloading room', { roomId, idleMs: Date.now() - entry.lastActivityAt });
			// Stop persisting events for this room.
			entry.unsubscribePersister();
			entry.unsubscribeMetrics();
			entry.unsubscribeFightStats();
			entry.unsubscribeFightSummary();
			entry.unsubscribeDebugLogger();
			// saveState is a getter returning the bound persist function — call it to flush
			// any state not yet written by the 30s debounce.
			entry.game.saveState();
			// Remove globalSemaphore listeners and stop ring timers so orphaned game
			// instances don't keep firing after the room is evicted from memory.
			entry.game.dispose();
		}
		this.active.delete(roomId);
		roomsActive.set(this.active.size);
	}

	async sweepIdleRooms(idleThresholdMs = 2 * 60 * 60 * 1000): Promise<void> {
		const now = Date.now();
		const promises: Promise<void>[] = [];
		for (const [roomId, entry] of this.active) {
			if (now - entry.lastActivityAt > idleThresholdMs) {
				promises.push(this.unloadRoom(roomId));
			}
		}
		log.debug('idle room sweep', {
			activeRooms: this.active.size,
			sweeping: promises.length,
			idleThresholdMs,
		});
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

	/**
	 * Events after `lastEventId` for ringFeed replay when the in-memory ring buffer
	 * no longer contains the cursor. Uses `room_events`; event ids are `${Date.now()}-…`
	 * so lexicographic `event_id` ordering matches time order when the anchor row is missing.
	 */
	async getEventsSinceForRingFeed(
		userId: string,
		roomId: string,
		lastEventId: string,
		limit = 500
	): Promise<GameEvent[]> {
		await this.assertMember(userId, roomId);

		const visibility = or(
			eq(roomEvents.scope, 'public'),
			and(eq(roomEvents.scope, 'private'), eq(roomEvents.targetUserId, userId))
		);

		const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
		const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

		// Anchor lookup uses event_id; migrations define room_events_room_id_event_id_key
		// (unique on room_id, event_id) and room_events_event_id_idx for efficient resolution.
		const anchor = await this.db
			.select({ id: roomEvents.id })
			.from(roomEvents)
			.where(and(eq(roomEvents.roomId, roomId), eq(roomEvents.eventId, lastEventId)))
			.limit(1);

		const afterId = anchor[0]?.id;

		if (afterId !== undefined) {
			const rows = await this.db
				.select()
				.from(roomEvents)
				.where(and(eq(roomEvents.roomId, roomId), visibility, gt(roomEvents.id, afterId)))
				.orderBy(asc(roomEvents.id))
				.limit(limit);
			return rows.map(dbRowToGameEvent);
		}

		let rows = await this.db
			.select()
			.from(roomEvents)
			.where(
				and(
					eq(roomEvents.roomId, roomId),
					visibility,
					gte(roomEvents.createdAt, cutoff24h),
					gt(roomEvents.eventId, lastEventId)
				)
			)
			.orderBy(asc(roomEvents.id))
			.limit(limit);

		if (rows.length > 0) {
			return rows.map(dbRowToGameEvent);
		}

		rows = await this.db
			.select()
			.from(roomEvents)
			.where(
				and(
					eq(roomEvents.roomId, roomId),
					visibility,
					gte(roomEvents.createdAt, cutoff7d),
					gt(roomEvents.eventId, lastEventId)
				)
			)
			.orderBy(asc(roomEvents.id))
			.limit(limit);

		return rows.map(dbRowToGameEvent);
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
		if (cached) {
			log.trace('room cache hit', { roomId });
			return Promise.resolve(cached);
		}

		const inflight = this.loading.get(roomId);
		if (inflight) {
			log.trace('room load already in flight, joining', { roomId });
			return inflight;
		}

		log.debug('room not in cache, loading from DB', { roomId });
		const promise = this._loadRoom(roomId).finally(() => {
			this.loading.delete(roomId);
		});
		this.loading.set(roomId, promise);
		return promise;
	}

	private async _loadRoom(roomId: string): Promise<ActiveRoom> {
		// Verify all lazy hydrators resolved — if any are still stubs, card hydration
		// will produce plain objects and fights will crash.
		const hydratorStatus = getHydratorStatus();
		const failedHydrators = Object.entries(hydratorStatus)
			.filter(([, ok]) => !ok)
			.map(([key]) => key);
		if (failedHydrators.length > 0) {
			roomHydrationWarnings.inc({ room_id: roomId });
			this.log({
				context: 'room-manager.loadRoom.hydratorWarning',
				roomId,
				failedHydrators,
				message: 'Some hydrators are still stubs — card hydration may be broken.',
			});
			log.warn('hydrator stubs detected — card hydration may be broken', {
				roomId,
				failedHydrators,
			});
		}

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

		const hasBlob = !!rows[0].stateBlob;
		log.debug('loading room from DB', { roomId, hasStateBlob: hasBlob });

		const stateStore = new PostgresStateStore(this.db);
		const roomLog = this._makeRoomLogger(roomId);
		let game: Game;

		if (rows[0].stateBlob) {
			try {
				game = this.deps.restoreGame(rows[0].stateBlob, roomLog);
				(game.options as Record<string, unknown>).roomId = roomId;
				log.debug('room restored from state blob', { roomId });
			} catch (err) {
				// Hydration failed — quarantine the bad blob so it can be inspected,
				// then start a fresh game so the room is usable again immediately.
				roomHydrationFailures.inc({ room_id: roomId });
				const message = err instanceof Error ? err.message : String(err);
				log.error('room hydration failed, quarantining blob and starting fresh', {
					roomId,
					error: message,
				});
				this.log(err);
				await this.db.update(rooms).set({
					stateBlob: null,
					quarantinedBlob: rows[0].stateBlob,
					updatedAt: new Date(),
				}).where(eq(rooms.id, roomId));
				game = new this.deps.Game({ roomId }, roomLog);
			}
		} else {
			log.debug('no state blob found, starting fresh game', { roomId });
			game = new this.deps.Game({ roomId }, roomLog);
		}

		game.stateStore = stateStore;

		const eventBus = game.eventBus;
		const unsubscribePersister = attachEventPersister(eventBus, this.db, this.log);
		const unsubscribeMetrics = attachMetricsCollector(eventBus, game.ring, roomId);
		const unsubscribeFightStats = attachFightStatsSubscriber(eventBus, this.db, this.log);
		const unsubscribeFightSummary = attachFightSummaryWriter(eventBus, this.db, this.log);
		const unsubscribeDebugLogger = attachDebugEventLogger(eventBus, game.ring, roomId);
		this._attachGameAnalytics(roomId, game);
		const entry: ActiveRoom = {
			game,
			eventBus,
			lastActivityAt: Date.now(),
			unsubscribePersister,
			unsubscribeMetrics,
			unsubscribeFightStats,
			unsubscribeFightSummary,
			unsubscribeDebugLogger,
		};
		this.active.set(roomId, entry);
		roomsActive.set(this.active.size);
		log.info('room loaded and active', { roomId, restored: hasBlob, activeRooms: this.active.size });
		return entry;
	}
}
