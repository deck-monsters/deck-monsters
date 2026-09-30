import { engineReady, restoreGame } from '@deck-monsters/engine';

import type { SerializedGame } from '@deck-monsters/engine';

// Builds a real serialized game the way the server stores it: hand-written seed options are
// hydrated by the engine (restoreGame) and then serialized by the engine (JSON.stringify), so
// the result has exactly the shape, defaults-stripping and minted ids of a production save.
// Known trap: a Basilisk seeded at level 7 (xp 1050) usually makes JSON.stringify(game) throw a
// circular-structure error (options.deck); Dragon, Gladiator and low-level Basilisks do not. Seeds
// here avoid it; see the task report for the repro.
// Used by the room-state view tests; kept out of the *.test.ts files so both can share it.
export interface SeedMonster {
	type: string;
	name: string;
	xp?: number;
	cards?: string[];
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
							deck: (c.deck ?? []).map((cardClass) => ({ name: cardClass, options: {} })),
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
	Object.values(game.getAllMonstersLookup() as Record<string, { stableId: string }>).forEach((m) => m.stableId);
	return JSON.parse(JSON.stringify(game)) as SerializedGame;
}
