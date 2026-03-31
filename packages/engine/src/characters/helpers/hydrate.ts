import type BaseCharacter from '../base.js';
import allCharacters from './all.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

// Lazy-load to break circular dependencies
let _hydrateDeck: AnyFn = (deck: unknown[]) => deck;
let _fillDeck: AnyFn = (deck: unknown[]) => deck;
let _hydrateItems: AnyFn = (items: unknown[]) => items;
let _hydrateMonster: AnyFn = (obj: unknown) => obj;

const loadHelpers = async () => {
	const [cardDeckModule, itemsModule, monstersModule] = await Promise.all([
		import('../../cards/helpers/deck.js').catch(() => null),
		import('../../items/helpers/hydrate.js').catch(() => null),
		import('../../monsters/helpers/hydrate.js').catch(() => null),
	]);

	if (cardDeckModule) {
		_hydrateDeck =
			(cardDeckModule as any).hydrateDeck ?? (cardDeckModule as any).default ?? _hydrateDeck;
		_fillDeck =
			(cardDeckModule as any).fillDeck ?? _fillDeck;
	}
	if (itemsModule) {
		_hydrateItems =
			(itemsModule as any).hydrateItems ??
			(itemsModule as any).default ??
			_hydrateItems;
	}
	if (monstersModule) {
		_hydrateMonster =
			(monstersModule as any).hydrateMonster ??
			(monstersModule as any).default ??
			_hydrateMonster;
	}
};

loadHelpers().catch(() => {
	// Helpers not ready yet; stubs remain in place
});

interface CharacterObj {
	name: string;
	options: {
		deck?: unknown[];
		items?: unknown[];
		monsters?: unknown[];
		[key: string]: unknown;
	};
}

const hydrateCharacter = (characterObj: CharacterObj): BaseCharacter => {
	const CharacterClass = allCharacters.find(({ name }) => name === characterObj.name);

	if (!CharacterClass) {
		throw new Error(`Unknown character type: ${characterObj.name}`);
	}

	const options = Object.assign(
		{ deck: [], items: [], monsters: [] },
		characterObj.options,
	);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(options as any).deck = _hydrateDeck(options.deck as unknown[]);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(options as any).items = _hydrateItems(options.items as unknown[]);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(options as any).monsters = (options.monsters as unknown[]).map(
		(monsterObj: unknown) => _hydrateMonster(monsterObj, options.deck),
	);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const character = new CharacterClass(options as Record<string, unknown>) as any;

	// If minimum deck size increased since last save, fill it up
	character.deck = _fillDeck((options as any).deck as unknown[], options, character);

	return character;
};

const hydrateCharacters = (charactersJSON: string): BaseCharacter[] =>
	(JSON.parse(charactersJSON) as CharacterObj[]).map(hydrateCharacter);

export { hydrateCharacter, hydrateCharacters };
