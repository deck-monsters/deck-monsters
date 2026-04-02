import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import type { SlashCommand, CommandContext } from './index.js';
import { resolveUser, dispatchCommand } from './helpers.js';
import { ensureConnectorUser } from '@deck-monsters/server/auth/connector-users';

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
		const guildId = interaction.guildId ?? `dm-${interaction.user.id}`;

		try {
			const supabaseUserId = await ensureConnectorUser(
				'discord',
				interaction.user.id,
				interaction.user.username
			);

			const roomId = await ctx.guildRoomManager.getOrCreateDefaultRoom(guildId, supabaseUserId);
			const game = await ctx.roomManager.getGame(roomId);
			const character = game.characters?.[supabaseUserId];
			const monsterNames: string[] = character?.monsters?.map((m: { name: string }) => m.name) ?? [];

			const filtered = monsterNames
				.filter((name) => name.toLowerCase().includes(focused))
				.slice(0, 25);

			await interaction.respond(filtered.map((name) => ({ name, value: name })));
		} catch {
			await interaction.respond([]);
		}
	},
};
