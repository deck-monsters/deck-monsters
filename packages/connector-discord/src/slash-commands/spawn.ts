import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, CommandContext } from './index.js';
import { resolveUser, dispatchCommand } from './helpers.js';

const executeTrain = async (
	interaction: ChatInputCommandInteraction,
	ctx: CommandContext,
): Promise<void> => {
		await interaction.deferReply({ ephemeral: true });

		const { supabaseUserId, roomId } = await resolveUser(interaction, ctx);

		const recognized = await dispatchCommand(
			interaction,
			'train a monster',
			ctx,
			supabaseUserId,
			roomId
		);

		if (!recognized) {
			await interaction.editReply('Could not train a monster. Try again in a moment.');
			return;
		}

		await interaction.editReply({ content: '✅ Done!', components: [] });
};

export const train: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('train')
		.setDescription('Train a new monster') as SlashCommandBuilder,
	execute: executeTrain,
};

// Discord does not have parser aliases. Keep the old command registered so an existing
// player is guided through the same training flow instead of seeing an unknown command.
export const spawn: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('spawn')
		.setDescription('Train a new monster (alias of /train)') as SlashCommandBuilder,
	execute: executeTrain,
};
