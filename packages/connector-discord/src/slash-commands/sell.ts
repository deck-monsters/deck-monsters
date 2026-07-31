import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, CommandContext } from './index.js';
import { resolveUser, dispatchCommand } from './helpers.js';

export const sell: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('sell')
		.setDescription('Sell cards or items to the shop') as SlashCommandBuilder,

	async execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const { supabaseUserId, roomId } = await resolveUser(interaction, ctx);

		const recognized = await dispatchCommand(
			interaction,
			'sell to the shop',
			ctx,
			supabaseUserId,
			roomId
		);

		if (!recognized) {
			await interaction.editReply('The shop is unavailable right now.');
			return;
		}

		await interaction.editReply({ content: '✅ Done!', components: [] });
	},
};
