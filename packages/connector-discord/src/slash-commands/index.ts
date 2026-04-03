import type { SlashCommandBuilder } from 'discord.js';
import type {
	ChatInputCommandInteraction,
	AutocompleteInteraction,
} from 'discord.js';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '@deck-monsters/server/db/schema';
import type { RoomManager } from '@deck-monsters/server/room-manager';
import type { DiscordBot } from '../bot.js';
import type { GuildRoomManager } from '../guild-room-manager.js';

import { spawn } from './spawn.js';
import { ring } from './ring.js';
import { equip } from './equip.js';
import { explore } from './explore.js';
import { shop } from './shop.js';
import { buy } from './buy.js';
import { use } from './use.js';
import { status } from './status.js';
import { monsters } from './monsters.js';
import { ringStatus } from './ring-status.js';
import { createRoom } from './create-room.js';
import { joinRoom } from './join-room.js';
import { help } from './help.js';

export interface CommandContext {
	bot: DiscordBot;
	roomManager: RoomManager;
	guildRoomManager: GuildRoomManager;
	db: NodePgDatabase<typeof schema>;
}

export interface SlashCommand {
	data: SlashCommandBuilder;
	execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void>;
	autocomplete?(interaction: AutocompleteInteraction, ctx: CommandContext): Promise<void>;
}

export function loadCommands(): Map<string, SlashCommand> {
	const commands: SlashCommand[] = [
		spawn,
		ring,
		equip,
		explore,
		shop,
		buy,
		use,
		status,
		monsters,
		ringStatus,
		createRoom,
		joinRoom,
		help,
	];

	const map = new Map<string, SlashCommand>();
	for (const cmd of commands) {
		map.set(cmd.data.name, cmd);
	}
	return map;
}
