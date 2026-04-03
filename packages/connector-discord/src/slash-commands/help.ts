import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, CommandContext } from './index.js';

const HELP_TEXT = `
**Deck Monsters — Commands**

**Slash Commands**
\`/spawn [type] [name]\` — Spawn a new monster
\`/equip [monster]\` — Equip cards onto one of your monsters
\`/ring [monster]\` — Send a monster into the ring to fight
\`/explore [monster]\` — Send a monster exploring
\`/shop\` — Visit the shop to browse items
\`/buy [item]\` — Buy an item from the shop
\`/use [item] [target]\` — Use an item on a monster or yourself
\`/status\` — View your character and monster status
\`/monsters\` — List all your monsters
\`/ring-status\` — Show current ring contestants
\`/create-room [name]\` — Create a new game room
\`/join-room [code]\` — Join a room by invite code

**Text Commands**
You can also type commands directly in DMs, or prefix them with \`dm\` in a server channel:

\`dm spawn a monster\`
\`dm equip <monster name>\`
\`dm send <monster name> to the ring\`
\`dm call <monster name> out of the ring\`
\`dm visit the shop\`
\`dm sell to the shop\`
\`dm give an item to <monster name>\`
\`dm take an item from <monster name>\`
\`dm use an item on <monster name>\`
\`dm use an item\`
\`dm look at <card|item|monster> <name>\`
\`dm look at cards\`
\`dm look at player handbook\`
`.trim();

export const help: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('Show all available Deck Monsters commands') as SlashCommandBuilder,

	async execute(interaction: ChatInputCommandInteraction, _ctx: CommandContext): Promise<void> {
		await interaction.reply({ content: HELP_TEXT, ephemeral: true });
	},
};
