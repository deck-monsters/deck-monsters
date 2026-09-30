export type CommandCategory = 'monsters' | 'ring' | 'cards' | 'items' | 'shop' | 'character' | 'info';

export interface CommandEntry {
	command: string;
	description: string;
	category: CommandCategory;
	example?: string;
}

export const COMMAND_CATALOG: CommandEntry[] = [
	// Monsters
	{ command: 'train a monster', description: 'Train a new monster', category: 'monsters' },
	{ command: 'equip [monster]', description: 'Equip a monster with your cards', category: 'monsters', example: 'equip Fluffy' },
	{ command: 'equip [monster] with "Card", "Card"', description: 'Equip a monster with the cards you name, separated by commas', category: 'monsters', example: 'equip Fluffy with "Hit", "Hit", "Heal"' },
	{ command: 'dismiss [monster]', description: 'Part ways with a monster for good', category: 'monsters', example: 'dismiss Fluffy' },
	{ command: 'revive [monster]', description: 'Revive a fallen monster', category: 'monsters', example: 'revive Fluffy' },
	{ command: 'look at monsters', description: 'View all your monsters', category: 'monsters' },
	{ command: 'look at monsters in detail', description: 'View your monsters with full stats', category: 'monsters' },
	{ command: 'look at [monster]', description: "View a specific monster's stats", category: 'monsters', example: 'look at Fluffy' },

	// Ring
	{ command: 'send [monster] to the ring', description: 'Send a monster to the ring', category: 'ring', example: 'send Fluffy to the ring' },
	{ command: 'send monster to the ring', description: 'Select a monster and send to the ring', category: 'ring' },
	{ command: 'call [monster] out of the ring', description: 'Call a monster out of the ring', category: 'ring', example: 'call Fluffy out of the ring' },
	{ command: 'summon a boss', description: 'Call a boss into the ring to fight your monster (3 per day)', category: 'ring' },
	{ command: 'look at the ring', description: 'See which monsters are currently fighting', category: 'ring' },

	// Cards
	{ command: 'look at cards', description: 'View your cards', category: 'cards' },
	{ command: 'look at card inventory', description: 'View equipped and unequipped cards together', category: 'cards' },
	{ command: 'look at all cards', description: 'Alias for card inventory', category: 'cards' },
	{ command: 'look at inventory', description: 'View all cards and items across your character and monsters', category: 'cards' },
	{ command: 'look at [card name]', description: 'View details about a specific card', category: 'cards', example: 'look at Hit' },
	{ command: 'look at card [card name]', description: 'View details about a specific card', category: 'cards', example: 'look at card Heal' },
	{ command: 'look at deck', description: 'View your full card inventory', category: 'cards' },
	{ command: 'unequip [card] from [monster]', description: 'Remove a card from a monster back to your cards', category: 'cards', example: 'unequip Hit from Fluffy' },
	{ command: 'unequip [count] [card] from [monster]', description: 'Remove multiple copies of a card from a monster', category: 'cards', example: 'unequip 2 Hit from Fluffy' },
	{ command: 'unequip all from [monster]', description: "Clear a monster's full deck back to your inventory", category: 'cards', example: 'unequip all from Fluffy' },
	{ command: 'move [card] from [monster A] to [monster B]', description: 'Move a card directly between monsters', category: 'cards', example: 'move Hit from Fluffy to Fang' },
	{ command: 'move [count] [card] from [monster A] to [monster B]', description: 'Move multiple copies directly between monsters', category: 'cards', example: 'move 2 Hit from Fluffy to Fang' },
	{ command: 'save preset [name] for [monster]', description: "Save a monster's current deck as a preset", category: 'cards', example: 'save preset tank for Fluffy' },
	{ command: 'load preset [name] on [monster]', description: 'Load a preset onto a monster', category: 'cards', example: 'load preset tank on Fluffy' },
	{ command: 'look at presets for [monster]', description: 'List saved presets for a monster', category: 'cards', example: 'look at presets for Fluffy' },
	{ command: 'delete preset [name] for [monster]', description: 'Delete a saved preset', category: 'cards', example: 'delete preset tank for Fluffy' },

	// Items
	{ command: 'look at items', description: 'View your items', category: 'items' },
	{ command: 'look at [item name]', description: 'View details about a specific item', category: 'items', example: 'look at Potion of Healing' },
	{ command: 'use item', description: 'Use one of your items on yourself', category: 'items' },
	{ command: 'use [item] on [monster]', description: 'Use an item on one of your monsters', category: 'items', example: 'use Potion of Healing on Fluffy' },
	{ command: 'give [item] to [monster]', description: 'Give an item to a monster to carry', category: 'items', example: 'give Potion of Healing to Fluffy' },
	{ command: 'take [item] from [monster]', description: 'Retrieve an item from a monster', category: 'items', example: 'take Potion of Healing from Fluffy' },

	// Shop
	{ command: 'visit the shop', description: 'Browse and buy items from the merchant', category: 'shop' },
	{ command: 'sell to the shop', description: 'Sell cards or items to the merchant', category: 'shop' },

	// Character
	{ command: 'edit my character', description: "Edit your character's name and icon", category: 'character' },
	{ command: 'look at character', description: 'View your character stats and info', category: 'character' },
	{ command: 'leave team', description: 'Take yourself and all your monsters off any team (a Sorting Hat, always in the shop, puts you on one)', category: 'character' },

	// Info
	{ command: 'help', description: 'Show this command reference', category: 'info' },
	{ command: 'look at player handbook', description: 'Read the full player handbook', category: 'info' },
	{ command: 'look at monster manual', description: 'Browse all monster types', category: 'info' },
	{ command: 'look at dm guide', description: 'Read the dungeon master guide', category: 'info' },
];

/** Shared with `build/markdown.ts`'s command-reference renderer so the two never drift. */
export const CATEGORY_LABELS: Record<CommandCategory, string> = {
	monsters: 'Monsters',
	ring: 'The Ring',
	cards: 'Cards',
	items: 'Items',
	shop: 'The Shop',
	character: 'Your Character',
	info: 'Reference',
};

export function formatCommandList(): string {
	const byCategory: Record<CommandCategory, CommandEntry[]> = {
		monsters: [],
		ring: [],
		cards: [],
		items: [],
		shop: [],
		character: [],
		info: [],
	};

	for (const entry of COMMAND_CATALOG) {
		byCategory[entry.category].push(entry);
	}

	const lines: string[] = ['Deck Monsters — Commands', ''];

	for (const [cat, entries] of Object.entries(byCategory) as [CommandCategory, CommandEntry[]][]) {
		if (entries.length === 0) continue;
		lines.push(`-- ${CATEGORY_LABELS[cat]} --`);
		for (const e of entries) {
			lines.push(`  ${e.command}`);
			lines.push(`    ${e.description}`);
		}
		lines.push('');
	}

	lines.push('Type help and a word to see those commands with an example, like help preset.');

	return lines.join('\n').trim();
}

/** A command with its `[placeholders]` removed and spaces squeezed, lowercased, for `help <word>`. */
function searchableText(command: string): string {
	return command.replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * `help <word>`: every catalogue entry whose command text (placeholders removed, so
 * `help monster` does not match every `[monster]`) contains the word(s).
 */
export function formatCommandSearch(word: string): string {
	const typed = word.trim();
	const needle = typed.replace(/\s+/g, ' ').toLowerCase();
	const matches = COMMAND_CATALOG.filter((e) => searchableText(e.command).includes(needle));

	if (!needle || matches.length === 0) {
		return `No command has "${typed}" in it. Type help to see them all.`;
	}

	const blocks = matches.map((e) => {
		const lines = [`  ${e.command}`, `    ${e.description}`];
		if (e.example) lines.push(`    Try: ${e.example}`);
		return lines.join('\n');
	});

	return `Commands with "${typed}":\n\n${blocks.join('\n\n')}`;
}
