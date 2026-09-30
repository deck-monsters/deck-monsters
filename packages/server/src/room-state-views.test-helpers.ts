import { engineReady, restoreGame } from '@deck-monsters/engine';

import type { SerializedGame } from '@deck-monsters/engine';

// Builds a real serialized game the way the server stores it: hand-written seed options are
// hydrated by the engine (restoreGame) and then serialized by the engine (JSON.stringify), so
// the result has exactly the shape, defaults-stripping and minted ids of a production save.
// Used by the room-state view tests; kept out of the *.test.ts files so both can share it.
export interface SeedMonster {
	type: string;
	name: string;
	xp?: number;
	cards?: string[];
	/** Leave the stableId getter untouched so the saved monster has none (a never-read monster). */
	skipStableId?: boolean;
}

export interface SeedCharacter {
	userId: string;
	type: string;
	name: string;
	xp?: number;
	coins?: number;
	deck?: string[];
	monsters?: SeedMonster[];
}

// Twenty cards is the engine's DEFAULT_MINIMUM_CARDS. A shorter saved deck makes
// characters/helpers/hydrate.ts fill it with `fillDeck(deck, options, character)`, which passes the
// character's own options to `new Card(options)`; the card then holds `options.deck`, the deck it
// sits in, and JSON.stringify(game) throws "circular structure" about half the time. Production
// decks are always full, so only under-filled test seeds hit it.
const FULL_DECK = Array.from({ length: 20 }, () => 'HitCard');

export async function buildSerializedGame(roomId: string, characters: SeedCharacter[]): Promise<SerializedGame> {
	// Hydration uses lazily loaded helpers; without this a first call can restore stub characters.
	await engineReady;
	const seed = {
		name: 'Game',
		options: {
			roomId,
			characters: Object.fromEntries(
				characters.map((c) => [
					c.userId,
					{
						name: c.type,
						options: {
							name: c.name,
							deck: (c.deck ?? FULL_DECK).map((cardClass) => ({ name: cardClass, options: {} })),
							deckInitialized: true,
							...(c.xp !== undefined ? { xp: c.xp } : {}),
							...(c.coins !== undefined ? { coins: c.coins } : {}),
							monsters: (c.monsters ?? []).map((m) => ({
								name: m.type,
								options: {
									name: m.name,
									...(m.xp !== undefined ? { xp: m.xp } : {}),
									cards: (m.cards ?? []).map((cardClass) => ({ name: cardClass, options: {} })),
								},
							})),
						},
					},
				])
			),
		},
	};

	const game = restoreGame(seed as unknown as Record<string, unknown>);
	// The stableId getter mints an id on first read and saves it; touch it so it is serialized,
	// as it is for any monster the ring or the analytics code has looked at.
	const skipped = new Set(
		characters.flatMap((c) => (c.monsters ?? []).filter((m) => m.skipStableId).map((m) => m.name.toLowerCase()))
	);
	Object.entries(game.getAllMonstersLookup() as Record<string, { stableId: string }>).forEach(([key, m]) => {
		if (!skipped.has(key)) void m.stableId;
	});
	return JSON.parse(JSON.stringify(game)) as SerializedGame;
}
