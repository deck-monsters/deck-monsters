import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, CommandContext } from './index.js';
import { resolveUser, dispatchCommand } from './helpers.js';

export const ringStatus: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('ring-status')
		.setDescription('Show the current ring contestants') as SlashCommandBuilder,

	async execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const { supabaseUserId, roomId } = await resolveUser(interaction, ctx);

		const recognized = await dispatchCommand(
			interaction,
			'look at the ring',
			ctx,
			supabaseUserId,
			roomId
		);

		if (!recognized) {
			await interaction.editReply('Could not retrieve ring status.');
			return;
		}

		await interaction.editReply({ content: '✅', components: [] });
	},
};
