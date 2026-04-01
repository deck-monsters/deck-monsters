import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import type { SlashCommand, CommandContext } from './index.js';
import { resolveUser, dispatchCommand } from './helpers.js';
import { ensureConnectorUser } from '@deck-monsters/server/auth/connector-users';

export const ring: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('ring')
		.setDescription('Send a monster to the ring')
		.addStringOption((opt) =>
			opt
				.setName('monster')
				.setDescription('Name of the monster to send')
				.setRequired(true)
				.setAutocomplete(true)
		) as SlashCommandBuilder,

	async execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const { supabaseUserId, roomId } = await resolveUser(interaction, ctx);
		const monsterName = interaction.options.getString('monster', true);

		const recognized = await dispatchCommand(
			interaction,
			`ring ${monsterName}`,
			ctx,
			supabaseUserId,
			roomId
		);

		if (!recognized) {
			await interaction.editReply(`Could not send **${monsterName}** to the ring.`);
			return;
		}

		await interaction.editReply({ content: '✅ Monster sent to the ring!', components: [] });
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
