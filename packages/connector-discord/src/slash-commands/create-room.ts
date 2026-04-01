import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, CommandContext } from './index.js';
import { resolveUser } from './helpers.js';

export const createRoom: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('create-room')
		.setDescription('Create a new game room for your friend group')
		.addStringOption((opt) =>
			opt.setName('name').setDescription('Room name').setRequired(true)
		) as SlashCommandBuilder,

	async execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const { supabaseUserId } = await resolveUser(interaction, ctx);
		const name = interaction.options.getString('name', true);
		const guildId = interaction.guildId ?? `dm-${interaction.user.id}`;

		const { roomId, inviteCode } = await ctx.guildRoomManager.createSubRoom(
			guildId,
			supabaseUserId,
			name
		);

		await interaction.editReply({
			content: `✅ Room **${name}** created!\nInvite code: \`${inviteCode}\`\nRoom ID: \`${roomId}\``,
			components: [],
		});
	},
};
