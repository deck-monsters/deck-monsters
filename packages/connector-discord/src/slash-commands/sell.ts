import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, CommandContext } from './index.js';
import { resolveUser, dispatchCommand } from './helpers.js';

export const sell: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('sell')
		.setDescription('Sell an item from your inventory')
		.addStringOption((opt) =>
			opt.setName('item').setDescription('Name of the item to sell').setRequired(true)
		) as SlashCommandBuilder,

	async execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const { supabaseUserId, roomId } = await resolveUser(interaction, ctx);
		const item = interaction.options.getString('item', true);

		const recognized = await dispatchCommand(
			interaction,
			`sell ${item}`,
			ctx,
			supabaseUserId,
			roomId
		);

		if (!recognized) {
			await interaction.editReply(`Could not sell **${item}**. Use \`/status\` to see your inventory.`);
			return;
		}

		await interaction.editReply({ content: '✅ Item sold!', components: [] });
	},
};
