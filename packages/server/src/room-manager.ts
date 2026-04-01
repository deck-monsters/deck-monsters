import { randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { eq, and } from 'drizzle-orm';

import { Game, RoomEventBus, restoreGame } from '@deck-monsters/engine';
import type { Db } from './db/index.js';
import { rooms, roomMembers } from './db/schema.js';
import { PostgresStateStore } from './state-store.js';

interface ActiveRoom {
	game: Game;
	eventBus: RoomEventBus;
}

function generateInviteCode(): string {
	return randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
}

export class RoomManager {
	private active = new Map<string, ActiveRoom>();

	constructor(
		private readonly db: Db,
		private readonly log: (err: unknown) => void = () => {}
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
		const game = new Game({ roomId }, this.log);
		game.stateStore = stateStore;

		const eventBus = game.eventBus;
		this.active.set(roomId, { game, eventBus });

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
		await this.db
			.delete(roomMembers)
			.where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)));
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

	async getRoomInfo(roomId: string): Promise<{ roomId: string; name: string; inviteCode: string }> {
		const rows = await this.db
			.select({ id: rooms.id, name: rooms.name, inviteCode: rooms.inviteCode })
			.from(rooms)
			.where(eq(rooms.id, roomId))
			.limit(1);

		if (!rows[0]) {
			throw new TRPCError({ code: 'NOT_FOUND', message: 'Room not found' });
		}

		return { roomId: rows[0].id, name: rows[0].name, inviteCode: rows[0].inviteCode };
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

	async getGame(roomId: string): Promise<Game> {
		return (await this._getOrLoad(roomId)).game;
	}

	async getEventBus(roomId: string): Promise<RoomEventBus> {
		return (await this._getOrLoad(roomId)).eventBus;
	}

	unloadRoom(roomId: string): void {
		this.active.delete(roomId);
	}

	private async _getOrLoad(roomId: string): Promise<ActiveRoom> {
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
			game = restoreGame(rows[0].stateBlob, this.log);
			(game.options as any).roomId = roomId;
		} else {
			game = new Game({ roomId }, this.log);
		}

		game.stateStore = stateStore;

		const entry: ActiveRoom = { game, eventBus: game.eventBus };
		this.active.set(roomId, entry);
		return entry;
	}
}
