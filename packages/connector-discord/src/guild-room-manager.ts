import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '@deck-monsters/server/db/schema';
import {
	guildRooms,
	guildUserActiveRooms,
	roomMembers,
	rooms,
} from '@deck-monsters/server/db/schema';
import type { RoomManager } from '@deck-monsters/server/room-manager';

type Db = NodePgDatabase<typeof schema>;

export interface GuildRoomInfo {
	roomId: string;
	isDefault: boolean;
	channelId: string | null;
}

function isUniqueViolation(err: unknown): boolean {
	return (
		typeof err === 'object' &&
		err !== null &&
		'code' in err &&
		(err as { code: unknown }).code === '23505'
	);
}

export class GuildRoomManager {
	constructor(
		private readonly db: Db,
		private readonly roomManager: RoomManager
	) {}

	/**
	 * Returns the default room ID for a guild.
	 * Auto-creates a room and the guild_rooms row on the first call.
	 * Concurrent creators converge on one default via the partial unique index;
	 * losers delete their orphan room through RoomManager.
	 * `userId` is the Discord user's Supabase id who is interacting
	 * (used as owner when creating, and always ensured as a room member).
	 */
	async getOrCreateDefaultRoom(guildId: string, userId: string): Promise<string> {
		const existing = await this._findDefaultRoom(guildId);
		if (existing) {
			await this.roomManager.ensureMember(userId, existing);
			return existing;
		}

		const { roomId } = await this.roomManager.createRoom(userId, `Guild ${guildId}`);

		try {
			await this.db.insert(guildRooms).values({
				guildId,
				roomId,
				isDefault: true,
				channelId: null,
			});
		} catch (err) {
			if (!isUniqueViolation(err)) throw err;

			// Another creator won the default slot — remove our orphan and join theirs.
			await this.roomManager.deleteRoom(userId, roomId);

			const winner = await this._findDefaultRoom(guildId);
			if (!winner) {
				throw new Error(`Default room race lost for guild ${guildId} but no winner found`);
			}
			await this.roomManager.ensureMember(userId, winner);
			return winner;
		}

		// Owner was inserted at create time; ensureMember is idempotent.
		await this.roomManager.ensureMember(userId, roomId);
		return roomId;
	}

	/**
	 * Creates a named sub-room for a guild, records the mapping, and selects it
	 * as the creating user's active room for this guild.
	 */
	async createSubRoom(
		guildId: string,
		ownerId: string,
		name: string
	): Promise<{ roomId: string; inviteCode: string }> {
		const { roomId, inviteCode } = await this.roomManager.createRoom(ownerId, name);

		await this.db.insert(guildRooms).values({
			guildId,
			roomId,
			isDefault: false,
			channelId: null,
		});

		await this.setActiveRoom(guildId, ownerId, roomId);

		return { roomId, inviteCode };
	}

	/** Returns all rooms registered for a guild. */
	async listGuildRooms(guildId: string): Promise<GuildRoomInfo[]> {
		const rows = await this.db
			.select({
				roomId: guildRooms.roomId,
				isDefault: guildRooms.isDefault,
				channelId: guildRooms.channelId,
			})
			.from(guildRooms)
			.where(eq(guildRooms.guildId, guildId));

		return rows;
	}

	/** Stores the Discord channel ID to use for public ring announcements. */
	async setAnnouncementChannel(
		guildId: string,
		roomId: string,
		channelId: string
	): Promise<void> {
		await this.db
			.update(guildRooms)
			.set({ channelId })
			.where(and(eq(guildRooms.guildId, guildId), eq(guildRooms.roomId, roomId)));
	}

	/** Returns the announcement channel ID for the default room, if set. */
	async getAnnouncementChannel(guildId: string): Promise<string | null> {
		const [row] = await this.db
			.select({ channelId: guildRooms.channelId })
			.from(guildRooms)
			.where(and(eq(guildRooms.guildId, guildId), eq(guildRooms.isDefault, true)))
			.limit(1);

		return row?.channelId ?? null;
	}

	/**
	 * Joins a room by invite code, ensures it is mapped to this guild, and
	 * selects it as the user's active room for the guild.
	 */
	async joinRoomByCode(
		guildId: string,
		userId: string,
		inviteCode: string
	): Promise<{ roomId: string }> {
		const { roomId } = await this.roomManager.joinRoom(userId, inviteCode);
		await this._ensureGuildRoomMapping(guildId, roomId);
		await this.setActiveRoom(guildId, userId, roomId);
		return { roomId };
	}

	/**
	 * Looks up the invite code for the default room of a guild.
	 * Needed so admins can share it for cross-guild players.
	 */
	async getDefaultRoomInviteCode(guildId: string): Promise<string | null> {
		const [row] = await this.db
			.select({ inviteCode: rooms.inviteCode })
			.from(guildRooms)
			.innerJoin(rooms, eq(guildRooms.roomId, rooms.id))
			.where(and(eq(guildRooms.guildId, guildId), eq(guildRooms.isDefault, true)))
			.limit(1);

		return row?.inviteCode ?? null;
	}

	/**
	 * Persists the user's active room for a guild.
	 * Caller must ensure the room is already mapped in guild_rooms.
	 */
	async setActiveRoom(guildId: string, userId: string, roomId: string): Promise<void> {
		await this.db
			.insert(guildUserActiveRooms)
			.values({ guildId, userId, roomId })
			.onConflictDoUpdate({
				target: [guildUserActiveRooms.guildId, guildUserActiveRooms.userId],
				set: { roomId, updatedAt: new Date() },
			});
	}

	/**
	 * Resolves which room a user should act in for this guild:
	 * validated active room (guild mapping + membership), else guild default
	 * with the active mapping repaired.
	 */
	async resolveRoomForUser(guildId: string, userId: string): Promise<string> {
		const active = await this._findValidatedActiveRoom(guildId, userId);
		if (active) return active;

		const defaultRoomId = await this.getOrCreateDefaultRoom(guildId, userId);
		await this.setActiveRoom(guildId, userId, defaultRoomId);
		return defaultRoomId;
	}

	private async _findDefaultRoom(guildId: string): Promise<string | null> {
		const [existing] = await this.db
			.select({ roomId: guildRooms.roomId })
			.from(guildRooms)
			.where(and(eq(guildRooms.guildId, guildId), eq(guildRooms.isDefault, true)))
			.limit(1);
		return existing?.roomId ?? null;
	}

	/**
	 * Returns the active room only when it is still mapped to the guild and the
	 * user is still a member. Stale / left / deleted mappings yield null.
	 */
	private async _findValidatedActiveRoom(
		guildId: string,
		userId: string
	): Promise<string | null> {
		const [row] = await this.db
			.select({ roomId: guildUserActiveRooms.roomId })
			.from(guildUserActiveRooms)
			.innerJoin(
				guildRooms,
				and(
					eq(guildRooms.guildId, guildUserActiveRooms.guildId),
					eq(guildRooms.roomId, guildUserActiveRooms.roomId)
				)
			)
			.innerJoin(
				roomMembers,
				and(
					eq(roomMembers.roomId, guildUserActiveRooms.roomId),
					eq(roomMembers.userId, guildUserActiveRooms.userId)
				)
			)
			.where(
				and(eq(guildUserActiveRooms.guildId, guildId), eq(guildUserActiveRooms.userId, userId))
			)
			.limit(1);

		return row?.roomId ?? null;
	}

	/** Ensures (guildId, roomId) exists in guild_rooms as a non-default mapping. */
	private async _ensureGuildRoomMapping(guildId: string, roomId: string): Promise<void> {
		const [existing] = await this.db
			.select({ roomId: guildRooms.roomId })
			.from(guildRooms)
			.where(and(eq(guildRooms.guildId, guildId), eq(guildRooms.roomId, roomId)))
			.limit(1);

		if (existing) return;

		await this.db.insert(guildRooms).values({
			guildId,
			roomId,
			isDefault: false,
			channelId: null,
		});
	}
}
