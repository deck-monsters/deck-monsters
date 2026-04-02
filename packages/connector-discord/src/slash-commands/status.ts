import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, CommandContext } from './index.js';
import { resolveUser, dispatchCommand } from './helpers.js';

export const status: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('status')
		.setDescription('View your character and monster status') as SlashCommandBuilder,

	async execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const { supabaseUserId, roomId } = await resolveUser(interaction, ctx);

		const recognized = await dispatchCommand(
			interaction,
			'look at me',
			ctx,
			supabaseUserId,
			roomId
		);

		if (!recognized) {
			await interaction.editReply('Could not retrieve your status.');
			return;
		}

		await interaction.editReply({ content: '✅', components: [] });
	},
};
