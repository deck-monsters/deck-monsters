import type BaseCharacter from '../base.js';
import allCharacters from './all.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

// Lazy-load to break circular dependencies
let _hydrateDeck: AnyFn = (deck: unknown[]) => deck;
let _fillDeck: AnyFn = (deck: unknown[]) => deck;
let _hydrateItems: AnyFn = (items: unknown[]) => items;
let _hydrateMonster: AnyFn = (obj: unknown) => obj;

let _hydratorStatus = { hydrateDeck: false, fillDeck: false, hydrateItems: false, hydrateMonster: false };

/** Returns whether lazy hydrators were successfully loaded (not stubs). */
export const getCharacterHydratorStatus = (): typeof _hydratorStatus => ({ ..._hydratorStatus });

const loadHelpers = async () => {
	const [cardHydrateModule, cardDeckModule, itemsModule, monstersModule] = await Promise.all([
		import('../../cards/helpers/hydrate.js').catch(() => null),
		import('../../cards/helpers/deck.js').catch(() => null),
		import('../../items/helpers/hydrate.js').catch(() => null),
		import('../../monsters/helpers/hydrate.js').catch(() => null),
	]);

	if (cardHydrateModule) {
		const fn = (cardHydrateModule as any).hydrateDeck;
		if (typeof fn === 'function') {
			_hydrateDeck = fn;
			_hydratorStatus.hydrateDeck = true;
		}
	}
	if (cardDeckModule) {
		const fn = (cardDeckModule as any).fillDeck;
		if (typeof fn === 'function') {
			_fillDeck = fn;
			_hydratorStatus.fillDeck = true;
		}
	}
	if (itemsModule) {
		const fn = (itemsModule as any).hydrateItems ?? (itemsModule as any).default;
		if (typeof fn === 'function') {
			_hydrateItems = fn;
			_hydratorStatus.hydrateItems = true;
		}
	}
	if (monstersModule) {
		const fn = (monstersModule as any).hydrateMonster ?? (monstersModule as any).default;
		if (typeof fn === 'function') {
			_hydrateMonster = fn;
			_hydratorStatus.hydrateMonster = true;
		}
	}
};

export const hydrateHelpersReady = loadHelpers().catch((err) => {
	console.error('[engine] hydrateHelpersReady FAILED — character hydration will be broken:', err);
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

const hydrateCharacter = (characterObj: CharacterObj, log?: (msg: string) => void): BaseCharacter => {
	let CharacterClass = allCharacters.find(({ name }) => name === characterObj.name);

	if (!CharacterClass) {
		// Fall back to the first character class (Beastmaster) rather than crashing
		// the entire game restore. The player keeps their data with a default class.
		log?.(`Unknown character type "${characterObj.name}", falling back to ${allCharacters[0]?.name ?? 'default'}`);
		CharacterClass = allCharacters[0];
	}

	if (!CharacterClass) {
		throw new Error('No character classes available for hydration');
	}

	const options = Object.assign(
		{ deck: [], items: [], monsters: [] },
		characterObj.options,
	);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(options as any).deck = _hydrateDeck(options.deck as unknown[]);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(options as any).items = (_hydrateItems(options.items as unknown[]) as unknown[]).filter(Boolean);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(options as any).monsters = (options.monsters as unknown[])
		.map((monsterObj: unknown) => {
			try {
				return _hydrateMonster(monsterObj, options.deck);
			} catch (err) {
				log?.(`Failed to hydrate monster, skipping: ${err}`);
				return null;
			}
		})
		.filter(Boolean);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const character = new CharacterClass(options as Record<string, unknown>) as any;

	// If minimum deck size increased since last save, fill it up
	character.deck = _fillDeck((options as any).deck as unknown[], options, character);

	return character;
};

const hydrateCharacters = (charactersJSON: string): BaseCharacter[] =>
	(JSON.parse(charactersJSON) as CharacterObj[]).map(obj => hydrateCharacter(obj));

export { hydrateCharacter, hydrateCharacters };
