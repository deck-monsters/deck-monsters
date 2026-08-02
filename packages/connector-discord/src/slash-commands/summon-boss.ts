import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, CommandContext } from './index.js';
import { resolveUser, dispatchCommand } from './helpers.js';

export const summonBoss: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('summon-boss')
		.setDescription(
			'Call a boss into the ring to fight your monster (3 summons per day)'
		) as SlashCommandBuilder,

	async execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const { supabaseUserId, roomId } = await resolveUser(interaction, ctx);

		// The quota and every refusal message live in the engine's command handler, so this
		// (and the web console) get identical behaviour for free. See docs/boss-encounters.md.
		const recognized = await dispatchCommand(
			interaction,
			'summon a boss',
			ctx,
			supabaseUserId,
			roomId
		);

		if (!recognized) {
			await interaction.editReply('Could not summon a boss right now.');
			return;
		}

		await interaction.editReply({ content: '✅ Done!', components: [] });
	},
};
