import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '@deck-monsters/server/db/schema';
import { guildRooms, rooms } from '@deck-monsters/server/db/schema';
import type { RoomManager } from '@deck-monsters/server/room-manager';

type Db = NodePgDatabase<typeof schema>;

export interface GuildRoomInfo {
	roomId: string;
	isDefault: boolean;
	channelId: string | null;
}

export class GuildRoomManager {
	constructor(
		private readonly db: Db,
		private readonly roomManager: RoomManager
	) {}

	/**
	 * Returns the default room ID for a guild.
	 * Auto-creates a room and the guild_rooms row on the first call.
	 * `botUserId` is the Supabase user ID for the bot itself (used as owner).
	 */
	async getOrCreateDefaultRoom(guildId: string, botUserId: string): Promise<string> {
		const [existing] = await this.db
			.select({ roomId: guildRooms.roomId })
			.from(guildRooms)
			.where(and(eq(guildRooms.guildId, guildId), eq(guildRooms.isDefault, true)))
			.limit(1);

		if (existing) return existing.roomId;

		const { roomId } = await this.roomManager.createRoom(botUserId, `Guild ${guildId}`);

		await this.db.insert(guildRooms).values({
			guildId,
			roomId,
			isDefault: true,
			channelId: null,
		});

		return roomId;
	}

	/**
	 * Creates a named sub-room for a guild and records the mapping.
	 * `ownerId` is the Supabase user ID of the Discord user creating the room.
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
	 * Resolves the room a user wants to join via invite code.
	 * Delegates to the underlying RoomManager.
	 */
	async joinRoomByCode(userId: string, inviteCode: string): Promise<{ roomId: string }> {
		return this.roomManager.joinRoom(userId, inviteCode);
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
}
