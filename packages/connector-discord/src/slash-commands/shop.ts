import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, CommandContext } from './index.js';
import { resolveUser, dispatchCommand } from './helpers.js';

export const shop: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('shop')
		.setDescription('Browse the item shop') as SlashCommandBuilder,

	async execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const { supabaseUserId, roomId } = await resolveUser(interaction, ctx);

		const recognized = await dispatchCommand(
			interaction,
			'shop',
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
