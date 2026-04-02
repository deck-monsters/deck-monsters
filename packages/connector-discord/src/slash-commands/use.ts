import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, CommandContext } from './index.js';
import { resolveUser, dispatchCommand } from './helpers.js';

export const use: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('use')
		.setDescription('Use an item on a monster')
		.addStringOption((opt) =>
			opt.setName('item').setDescription('Name of the item to use').setRequired(true)
		)
		.addStringOption((opt) =>
			opt.setName('target').setDescription('Monster to use the item on').setRequired(false)
		) as SlashCommandBuilder,

	async execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const { supabaseUserId, roomId } = await resolveUser(interaction, ctx);
		const item = interaction.options.getString('item', true);
		const target = interaction.options.getString('target');

		const command = target ? `use ${item} on ${target}` : `use ${item}`;

		const recognized = await dispatchCommand(
			interaction,
			command,
			ctx,
			supabaseUserId,
			roomId
		);

		if (!recognized) {
			await interaction.editReply(`Could not use **${item}**.`);
			return;
		}

		await interaction.editReply({ content: '✅ Item used!', components: [] });
	},
};
