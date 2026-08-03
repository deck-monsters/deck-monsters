import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, CommandContext } from './index.js';
import { resolveConnectorUserId } from './helpers.js';

export const joinRoom: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('join-room')
		.setDescription('Join an existing game room with an invite code')
		.addStringOption((opt) =>
			opt.setName('code').setDescription('Invite code').setRequired(true)
		) as SlashCommandBuilder,

	async execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const supabaseUserId = await resolveConnectorUserId(interaction, ctx);
		const inviteCode = interaction.options.getString('code', true);
		const guildId = interaction.guildId ?? `dm-${interaction.user.id}`;

		try {
			const { roomId } = await ctx.guildRoomManager.joinRoomByCode(
				guildId,
				supabaseUserId,
				inviteCode
			);
			await interaction.editReply({
				content: `✅ Joined room \`${roomId}\`!`,
				components: [],
			});
		} catch {
			await interaction.editReply('Invalid invite code or the room no longer exists.');
		}
	},
};
