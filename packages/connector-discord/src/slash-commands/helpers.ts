import type { ChatInputCommandInteraction, Message } from 'discord.js';
import { ensureConnectorUser } from '@deck-monsters/server/auth/connector-users';
import type { CommandContext } from './index.js';
import { runDiscordCommandAction } from '../command-flow.js';

export interface ResolvedUser {
	supabaseUserId: string;
	roomId: string;
}

/**
 * Ensures a Supabase user record exists for the Discord user.
 * Does not resolve or mutate active-room selection.
 */
export async function resolveConnectorUserId(
	interaction: ChatInputCommandInteraction,
	ctx: CommandContext
): Promise<string> {
	return ensureConnectorUser(
		'discord',
		interaction.user.id,
		interaction.user.username,
		ctx.db
	);
}

/**
 * Ensures a Supabase user record exists for the Discord user and resolves
 * their active room for the guild (falling back to the guild default).
 */
export async function resolveUser(
	interaction: ChatInputCommandInteraction,
	ctx: CommandContext
): Promise<ResolvedUser> {
	const supabaseUserId = await resolveConnectorUserId(interaction, ctx);

	const guildId = interaction.guildId ?? `dm-${interaction.user.id}`;
	const roomId = await ctx.guildRoomManager.resolveRoomForUser(guildId, supabaseUserId);

	return { supabaseUserId, roomId };
}

/**
 * Gets the game for a room and dispatches a command through it.
 * Returns true if the command was recognized and executed, false otherwise.
 *
 * Interactive actions run in `runSerializedEngineWork(`${roomId}:${userId}`)`
 * with connector-local active-flow ownership (see `command-flow.ts`). The
 * Discord request may await the action; prompt answers still arrive outside
 * that lane via collectors / ConnectorAdapter.
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

	await runDiscordCommandAction({
		roomManager: ctx.roomManager,
		roomId,
		userId: supabaseUserId,
		action: () =>
			action({
				channel,
				channelName: interaction.channelId ?? 'discord',
				isAdmin: role === 'owner',
				// Discord slash commands are always scoped to a specific user and reply
				// ephemerally, so they behave as DMs regardless of where they're invoked.
				isDM: true,
				user: { id: supabaseUserId, name: interaction.user.username },
			}),
	});

	return true;
}

/**
 * Dispatches a free-text DM / `dm <command>` message through the same
 * per-user flow lock and engine lane as slash commands.
 */
export async function dispatchFreeTextCommand(opts: {
	ctx: CommandContext;
	message: Message;
	commandText: string;
	supabaseUserId: string;
	roomId: string;
	isDM: boolean;
}): Promise<boolean> {
	const { ctx, message, commandText, supabaseUserId, roomId, isDM } = opts;

	const game = await ctx.roomManager.getGame(roomId);
	const action = game.handleCommand({ command: commandText });
	if (!action) return false;

	const guildId = message.guildId ?? `dm-${message.author.id}`;
	const sub = await ctx.bot.getOrCreateSubscription(guildId, roomId);
	sub.registerUserFromMessage(message.author.id, supabaseUserId);

	const channel = sub.buildPrivateChannel(message.author.id, undefined, supabaseUserId);
	const role = await ctx.roomManager.getMemberRole(supabaseUserId, roomId);

	await runDiscordCommandAction({
		roomManager: ctx.roomManager,
		roomId,
		userId: supabaseUserId,
		action: () =>
			action({
				channel,
				channelName: message.channelId,
				isAdmin: role === 'owner',
				isDM,
				user: { id: supabaseUserId, name: message.author.username },
			}),
	});

	return true;
}
