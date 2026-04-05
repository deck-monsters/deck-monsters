import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, CommandContext } from './index.js';
import { resolveUser, dispatchCommand } from './helpers.js';

export const revive: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('revive')
		.setDescription('Revive a knocked-out monster (costs coins)')
		.addStringOption((opt) =>
			opt
				.setName('monster')
				.setDescription('Name of the monster to revive')
				.setRequired(true)
				.setAutocomplete(true)
		) as SlashCommandBuilder,

	async execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const { supabaseUserId, roomId } = await resolveUser(interaction, ctx);
		const monster = interaction.options.getString('monster', true);

		const recognized = await dispatchCommand(
			interaction,
			`revive ${monster}`,
			ctx,
			supabaseUserId,
			roomId
		);

		if (!recognized) {
			await interaction.editReply(
				`Could not revive **${monster}**. Use \`/monsters\` to see your roster.`
			);
			return;
		}

		await interaction.editReply({ content: `✨ ${monster} is back on their feet!`, components: [] });
	},

	async autocomplete(interaction, ctx): Promise<void> {
		const focused = interaction.options.getFocused().toLowerCase();
		try {
			const { supabaseUserId, roomId } = await resolveUser(
				interaction as unknown as ChatInputCommandInteraction,
				ctx
			);
			const game = await ctx.roomManager.getGame(roomId);
			const character = await game.getCharacter({
				channel: null,
				id: supabaseUserId,
				name: interaction.user.username,
			});
			const names: string[] = character.monsters
				? (character.monsters as Array<{ givenName: string }>)
						.map((m) => m.givenName)
						.filter((n) => n.toLowerCase().includes(focused))
						.slice(0, 25)
				: [];
			await interaction.respond(names.map((n) => ({ name: n, value: n })));
		} catch {
			await interaction.respond([]);
		}
	},
};
