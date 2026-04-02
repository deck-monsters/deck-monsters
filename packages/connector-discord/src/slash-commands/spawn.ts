import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, CommandContext } from './index.js';
import { resolveUser, dispatchCommand } from './helpers.js';

export const spawn: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('spawn')
		.setDescription('Spawn a new monster')
		.addStringOption((opt) =>
			opt
				.setName('type')
				.setDescription('Monster type (e.g. Basilisk, Minotaur, Jinn)')
				.setRequired(false)
		)
		.addStringOption((opt) =>
			opt.setName('name').setDescription('A name for your monster').setRequired(false)
		) as SlashCommandBuilder,

	async execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const { supabaseUserId, roomId } = await resolveUser(interaction, ctx);

		const type = interaction.options.getString('type') ?? '';
		const name = interaction.options.getString('name') ?? '';

		// Build a natural-language command string the engine understands
		const parts = ['spawn'];
		if (type) parts.push(type);
		if (name) parts.push(name);
		const command = parts.join(' ');

		const recognized = await dispatchCommand(
			interaction,
			command,
			ctx,
			supabaseUserId,
			roomId
		);

		if (!recognized) {
			await interaction.editReply('Could not spawn a monster. Try a valid type like `Basilisk`.');
			return;
		}

		await interaction.editReply({ content: '✅ Done!', components: [] });
	},
};
