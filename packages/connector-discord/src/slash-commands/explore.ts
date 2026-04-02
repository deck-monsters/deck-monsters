import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, CommandContext } from './index.js';
import { resolveUser, dispatchCommand } from './helpers.js';

export const explore: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('explore')
		.setDescription('Send a monster on an exploration')
		.addStringOption((opt) =>
			opt
				.setName('monster')
				.setDescription('Name of the monster to send exploring')
				.setRequired(true)
		) as SlashCommandBuilder,

	async execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const { supabaseUserId, roomId } = await resolveUser(interaction, ctx);
		const monsterName = interaction.options.getString('monster', true);

		const recognized = await dispatchCommand(
			interaction,
			`explore ${monsterName}`,
			ctx,
			supabaseUserId,
			roomId
		);

		if (!recognized) {
			await interaction.editReply(`Could not send **${monsterName}** exploring.`);
			return;
		}

		await interaction.editReply({ content: '✅ Monster sent exploring!', components: [] });
	},
};
