import { db } from '@deck-monsters/server/db';
import { RoomManager } from '@deck-monsters/server/room-manager';
import { GuildRoomManager } from './guild-room-manager.js';
import { DiscordBot } from './bot.js';

const DISCORD_TOKEN = process.env['DISCORD_TOKEN'];
const DISCORD_CLIENT_ID = process.env['DISCORD_CLIENT_ID'];

if (!DISCORD_TOKEN) throw new Error('DISCORD_TOKEN environment variable is required');
if (!DISCORD_CLIENT_ID) throw new Error('DISCORD_CLIENT_ID environment variable is required');

const roomManager = new RoomManager(db);
const guildRoomManager = new GuildRoomManager(db, roomManager);
const bot = new DiscordBot(roomManager, guildRoomManager, db);

// Sweep idle rooms every 10 minutes — mirrors the server's sweep interval
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
setInterval(() => {
	roomManager.sweepIdleRooms().catch((err: unknown) => {
		console.error('sweepIdleRooms failed:', err);
	});
}, SWEEP_INTERVAL_MS).unref();

await bot.start(DISCORD_TOKEN, DISCORD_CLIENT_ID);
