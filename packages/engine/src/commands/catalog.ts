export type CommandCategory = 'monsters' | 'ring' | 'cards' | 'items' | 'shop' | 'character' | 'info';

export interface CommandEntry {
	command: string;
	description: string;
	category: CommandCategory;
	example?: string;
}

export const COMMAND_CATALOG: CommandEntry[] = [
	// Monsters
	{ command: 'spawn monster', description: 'Spawn a new monster', category: 'monsters' },
	{ command: 'equip [monster]', description: 'Equip a monster with cards from your deck', category: 'monsters', example: 'equip Fluffy' },
	{ command: 'equip [monster] with "Card", "Card"', description: 'Equip a monster with specific cards', category: 'monsters', example: 'equip Fluffy with "Hit", "Hit", "Heal"' },
	{ command: 'dismiss [monster]', description: 'Release a monster', category: 'monsters', example: 'dismiss Fluffy' },
	{ command: 'revive [monster]', description: 'Revive a dead monster', category: 'monsters', example: 'revive Fluffy' },
	{ command: 'look at monsters', description: 'View all your monsters', category: 'monsters' },
	{ command: 'look at monsters in detail', description: 'View your monsters with full stats', category: 'monsters' },
	{ command: 'look at [monster]', description: "View a specific monster's stats", category: 'monsters', example: 'look at Fluffy' },

	// Ring
	{ command: 'send [monster] to the ring', description: 'Send a monster into battle', category: 'ring', example: 'send Fluffy to the ring' },
	{ command: 'send monster to the ring', description: 'Select a monster and send to the ring', category: 'ring' },
	{ command: 'summon [monster] from the ring', description: 'Call a monster back from battle', category: 'ring', example: 'summon Fluffy from the ring' },
	{ command: 'look at the ring', description: 'See which monsters are currently fighting', category: 'ring' },

	// Cards
	{ command: 'look at cards', description: 'View all cards in your deck', category: 'cards' },
	{ command: 'look at [card name]', description: 'View details about a specific card', category: 'cards', example: 'look at Hit' },
	{ command: 'look at card [card name]', description: 'View details about a specific card', category: 'cards', example: 'look at card Heal' },
	{ command: 'look at deck', description: 'View your full card deck', category: 'cards' },

	// Items
	{ command: 'look at items', description: 'View your items', category: 'items' },
	{ command: 'look at [item name]', description: 'View details about a specific item', category: 'items', example: 'look at Potion' },
	{ command: 'use item', description: 'Use one of your items on yourself', category: 'items' },
	{ command: 'use [item] on [monster]', description: 'Use an item on one of your monsters', category: 'items', example: 'use Potion on Fluffy' },
	{ command: 'give item to [monster]', description: 'Give an item to a monster to carry', category: 'items', example: 'give item to Fluffy' },
	{ command: 'take item from [monster]', description: 'Retrieve an item from a monster', category: 'items', example: 'take item from Fluffy' },

	// Shop
	{ command: 'visit the shop', description: 'Browse and buy items from the merchant', category: 'shop' },
	{ command: 'sell to the shop', description: 'Sell cards or items to the merchant', category: 'shop' },

	// Character
	{ command: 'edit my character', description: "Edit your character's name and icon", category: 'character' },
	{ command: 'look at character', description: 'View your character stats and info', category: 'character' },

	// Info
	{ command: 'help', description: 'Show this command reference', category: 'info' },
	{ command: 'look at player handbook', description: 'Read the full player handbook', category: 'info' },
	{ command: 'look at monster manual', description: 'Browse all monster types', category: 'info' },
	{ command: 'look at dm guide', description: 'Read the dungeon master guide', category: 'info' },
];

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

	const categoryLabels: Record<CommandCategory, string> = {
		monsters: 'Monsters',
		ring: 'The Ring',
		cards: 'Cards',
		items: 'Items',
		shop: 'The Shop',
		character: 'Your Character',
		info: 'Reference',
	};

	for (const [cat, entries] of Object.entries(byCategory) as [CommandCategory, CommandEntry[]][]) {
		if (entries.length === 0) continue;
		lines.push(`-- ${categoryLabels[cat]} --`);
		for (const e of entries) {
			lines.push(`  ${e.command}`);
			lines.push(`    ${e.description}`);
		}
		lines.push('');
	}

	return lines.join('\n').trim();
}
