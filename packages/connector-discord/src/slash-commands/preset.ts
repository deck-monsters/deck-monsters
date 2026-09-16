import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import type { SlashCommand, CommandContext } from './index.js';
import { resolveUser, dispatchCommand } from './helpers.js';

/**
 * Loads the caller's character for autocomplete. Returns `undefined` rather
 * than throwing so a failed lookup degrades to an empty suggestion list — an
 * autocomplete response is required within 3s and cannot surface an error.
 */
async function loadCharacter(
	interaction: AutocompleteInteraction,
	ctx: CommandContext
): Promise<Record<string, unknown> | undefined> {
	const { supabaseUserId, roomId } = await resolveUser(
		interaction as unknown as ChatInputCommandInteraction,
		ctx
	);
	const game = await ctx.roomManager.getGame(roomId);
	return game.getCharacter({
		channel: null,
		id: supabaseUserId,
		name: interaction.user.username,
	});
}

function monsterNames(character: Record<string, unknown> | undefined): string[] {
	const monsters = character?.monsters as Array<{ givenName: string }> | undefined;
	return monsters ? monsters.map((m) => m.givenName) : [];
}

export const preset: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('preset')
		.setDescription('Save, load, delete, or list a monster’s saved deck presets')
		.addSubcommand((sub) =>
			sub
				.setName('save')
				.setDescription('Save a monster’s current deck as a named preset')
				.addStringOption((opt) =>
					opt
						.setName('monster')
						.setDescription('Monster whose deck to save')
						.setRequired(true)
						.setAutocomplete(true)
				)
				.addStringOption((opt) =>
					opt.setName('name').setDescription('Name for the preset').setRequired(true)
				)
		)
		.addSubcommand((sub) =>
			sub
				.setName('load')
				.setDescription('Equip a saved preset onto a monster')
				.addStringOption((opt) =>
					opt
						.setName('monster')
						.setDescription('Monster to equip')
						.setRequired(true)
						.setAutocomplete(true)
				)
				.addStringOption((opt) =>
					opt
						.setName('name')
						.setDescription('Preset to load')
						.setRequired(true)
						.setAutocomplete(true)
				)
		)
		.addSubcommand((sub) =>
			sub
				.setName('delete')
				.setDescription('Delete a saved preset')
				.addStringOption((opt) =>
					opt
						.setName('monster')
						.setDescription('Monster the preset belongs to')
						.setRequired(true)
						.setAutocomplete(true)
				)
				.addStringOption((opt) =>
					opt
						.setName('name')
						.setDescription('Preset to delete')
						.setRequired(true)
						.setAutocomplete(true)
				)
		)
		.addSubcommand((sub) =>
			sub
				.setName('list')
				.setDescription('List saved presets')
				.addStringOption((opt) =>
					opt
						.setName('monster')
						.setDescription('Limit to one monster (omit for all)')
						.setRequired(false)
						.setAutocomplete(true)
				)
		) as unknown as SlashCommandBuilder,

	async execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const { supabaseUserId, roomId } = await resolveUser(interaction, ctx);
		const sub = interaction.options.getSubcommand();
		const monster = interaction.options.getString('monster');
		const name = interaction.options.getString('name');

		// Mirrors the engine's text-command grammar (commands/presets.ts). The
		// monster name is the trailing token in every form, which is what the
		// engine's greedy preset-name capture relies on to split correctly.
		let command: string;
		let success: string;
		let failure: string;

		if (sub === 'list') {
			command = monster ? `look at presets for ${monster}` : 'look at presets';
			success = '✅';
			failure = 'Could not list your presets.';
		} else if (sub === 'save') {
			command = `save preset ${name} for ${monster}`;
			success = `✅ Saved preset **${name}** for **${monster}**.`;
			failure = `Could not save preset **${name}** for **${monster}**.`;
		} else if (sub === 'load') {
			command = `load preset ${name} on ${monster}`;
			success = `✅ Loaded preset **${name}** onto **${monster}**.`;
			failure = `Could not load preset **${name}** onto **${monster}**.`;
		} else {
			command = `delete preset ${name} for ${monster}`;
			success = `🗑️ Deleted preset **${name}** for **${monster}**.`;
			failure = `Could not delete preset **${name}** for **${monster}**.`;
		}

		const recognized = await dispatchCommand(
			interaction,
			command,
			ctx,
			supabaseUserId,
			roomId
		);

		await interaction.editReply({ content: recognized ? success : failure, components: [] });
	},

	async autocomplete(interaction: AutocompleteInteraction, ctx: CommandContext): Promise<void> {
		const focused = interaction.options.getFocused(true);
		const query = String(focused.value ?? '').toLowerCase();

		try {
			const character = await loadCharacter(interaction, ctx);

			if (focused.name === 'monster') {
				const names = monsterNames(character)
					.filter((n) => n.toLowerCase().includes(query))
					.slice(0, 25);
				await interaction.respond(names.map((n) => ({ name: n, value: n })));
				return;
			}

			// Preset-name autocomplete is scoped to the monster already chosen in
			// this interaction; without one there is nothing meaningful to suggest.
			const monster = interaction.options.getString('monster');
			const getPresets = character?.getPresets as
				| ((monsterName?: string) => Record<string, string[]>)
				| undefined;
			if (!monster || typeof getPresets !== 'function') {
				await interaction.respond([]);
				return;
			}

			const presets = Object.keys(getPresets(monster) ?? {})
				.filter((n) => n.toLowerCase().includes(query))
				.sort((a, b) => a.localeCompare(b))
				.slice(0, 25);
			await interaction.respond(presets.map((n) => ({ name: n, value: n })));
		} catch {
			await interaction.respond([]);
		}
	},
};
