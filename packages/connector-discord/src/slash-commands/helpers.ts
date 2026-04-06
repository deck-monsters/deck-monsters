import type { ChatInputCommandInteraction } from 'discord.js';
import { ensureConnectorUser } from '@deck-monsters/server/auth/connector-users';
import type { CommandContext } from './index.js';

export interface ResolvedUser {
	supabaseUserId: string;
	roomId: string;
}

/**
 * Ensures a Supabase user record exists for the Discord user and resolves
 * (or auto-creates) the default room for the guild.
 */
export async function resolveUser(
	interaction: ChatInputCommandInteraction,
	ctx: CommandContext
): Promise<ResolvedUser> {
	const supabaseUserId = await ensureConnectorUser(
		'discord',
		interaction.user.id,
		interaction.user.username
	);

	const guildId = interaction.guildId ?? `dm-${interaction.user.id}`;
	const roomId = await ctx.guildRoomManager.getOrCreateDefaultRoom(guildId, supabaseUserId);

	return { supabaseUserId, roomId };
}

/**
 * Gets the game for a room and dispatches a command through it.
 * Returns true if the command was recognized and executed, false otherwise.
 *
 * The caller must have already deferred the interaction reply.
 */
export async function dispatchCommand(
	interaction: ChatInputCommandInteraction,
	command: string,
	ctx: CommandContext,
	supabaseUserId: string,
	roomId: string
): Promise<boolean> {
	const game = await ctx.roomManager.getGame(roomId);
	const action = game.handleCommand({ command });

	if (!action) return false;

	const guildId = interaction.guildId ?? `dm-${interaction.user.id}`;
	const sub = await ctx.bot.getOrCreateSubscription(guildId, roomId);
	sub.registerUser(interaction.user.id, supabaseUserId, interaction);

	const channel = sub.buildPrivateChannel(interaction.user.id, interaction, supabaseUserId);

	const role = await ctx.roomManager.getMemberRole(supabaseUserId, roomId);

	await action({
		channel,
		channelName: interaction.channelId ?? 'discord',
		isAdmin: role === 'owner',
		isDM: !interaction.guildId,
		user: { id: supabaseUserId, name: interaction.user.username },
	});

	return true;
}
