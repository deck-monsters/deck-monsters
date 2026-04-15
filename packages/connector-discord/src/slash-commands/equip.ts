import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import type { SlashCommand, CommandContext } from './index.js';
import { resolveUser, dispatchCommand } from './helpers.js';

export const equip: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('equip')
		.setDescription('Equip a monster with a new deck')
		.addStringOption((opt) =>
			opt
				.setName('monster')
				.setDescription('Name of the monster to equip')
				.setRequired(true)
				.setAutocomplete(true)
		) as SlashCommandBuilder,

	async execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const { supabaseUserId, roomId } = await resolveUser(interaction, ctx);
		const monsterName = interaction.options.getString('monster', true);

		const recognized = await dispatchCommand(
			interaction,
			`equip ${monsterName}`,
			ctx,
			supabaseUserId,
			roomId
		);

		if (!recognized) {
			await interaction.editReply(`Could not equip **${monsterName}**.`);
			return;
		}

		await interaction.editReply({ content: '✅ Monster equipped!', components: [] });
	},

	async autocomplete(interaction: AutocompleteInteraction, ctx: CommandContext): Promise<void> {
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
