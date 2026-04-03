import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, CommandContext } from './index.js';

// The exploration system is archived and not available in the current revival.
// This command is kept registered so the slot isn't claimed by something else,
// but it returns a friendly "coming soon" message instead of attempting to
// dispatch to the engine. Remove this once exploration is re-implemented.
export const explore: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('explore')
		.setDescription('[Coming soon] Send a monster on an exploration')
		.addStringOption((opt) =>
			opt
				.setName('monster')
				.setDescription('Name of the monster to send exploring')
				.setRequired(true)
		) as SlashCommandBuilder,

	async execute(interaction: ChatInputCommandInteraction, _ctx: CommandContext): Promise<void> {
		await interaction.reply({
			content:
				'⛺ **Exploration is coming soon!** This feature is being rebuilt for the revival. ' +
				'Check back in a future update.',
			ephemeral: true,
		});
	},
};
