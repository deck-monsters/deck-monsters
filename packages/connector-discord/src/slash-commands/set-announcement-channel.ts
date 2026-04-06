import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, CommandContext } from './index.js';
import { resolveUser } from './helpers.js';

export const setAnnouncementChannel: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('set-announcement-channel')
		.setDescription('Set the channel where ring battle events are broadcast (room owners only)')
		.addChannelOption((opt) =>
			opt
				.setName('channel')
				.setDescription('Channel to send ring announcements to (defaults to current channel)')
				.setRequired(false)
		) as SlashCommandBuilder,

	async execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const { supabaseUserId, roomId } = await resolveUser(interaction, ctx);

		const role = await ctx.roomManager.getMemberRole(supabaseUserId, roomId);
		if (role !== 'owner') {
			await interaction.editReply({ content: '⛔ Only room owners can set the announcement channel.' });
			return;
		}

		const guildId = interaction.guildId ?? `dm-${interaction.user.id}`;
		const channelOption = interaction.options.getChannel('channel');
		const channelId = channelOption?.id ?? interaction.channelId;

		if (!channelId) {
			await interaction.editReply({ content: '⛔ Could not determine a channel to use.' });
			return;
		}

		await ctx.guildRoomManager.setAnnouncementChannel(guildId, roomId, channelId);

		const channelMention = `<#${channelId}>`;
		await interaction.editReply({
			content: `✅ Ring battle announcements will now be sent to ${channelMention}.`,
		});
	},
};
