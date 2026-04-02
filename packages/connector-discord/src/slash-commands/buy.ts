import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, CommandContext } from './index.js';
import { resolveUser, dispatchCommand } from './helpers.js';

export const buy: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('buy')
		.setDescription('Buy an item from the shop')
		.addStringOption((opt) =>
			opt.setName('item').setDescription('Name of the item to buy').setRequired(true)
		) as SlashCommandBuilder,

	async execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const { supabaseUserId, roomId } = await resolveUser(interaction, ctx);
		const item = interaction.options.getString('item', true);

		const recognized = await dispatchCommand(
			interaction,
			`buy ${item}`,
			ctx,
			supabaseUserId,
			roomId
		);

		if (!recognized) {
			await interaction.editReply(`Could not buy **${item}**.`);
			return;
		}

		await interaction.editReply({ content: '✅ Purchase complete!', components: [] });
	},
};
