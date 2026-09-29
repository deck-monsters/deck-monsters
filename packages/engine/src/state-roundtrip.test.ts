import { expect } from 'chai';

import Game from './game.js';
import { restoreGame } from './index.js';
import Basilisk from './monsters/basilisk.js';
import Beastmaster from './characters/beastmaster.js';

/*
 * Roadmap 37 task 1 guard. Room state is about to live in a Postgres `jsonb` column, which does
 * NOT keep object key order: keys come back sorted by UTF-8 byte length, then bytewise. This test
 * saves a game, re-sorts every object the way jsonb would, restores it, and checks that nothing
 * a player can see depends on the original key order. Commit 973b0d81 fixed the three known
 * order-dependent spots (rankings ties, preset lookup, monster name lookup); this test fails if
 * any of them regresses, or if a new one is introduced on the same data.
 */

const utf8Bytes = (s: string): Buffer => Buffer.from(s, 'utf8');

/** Order keys as jsonb does: shorter (in UTF-8 bytes) first, then bytewise ascending. */
const compareJsonbKeys = (a: string, b: string): number => {
	const ba = utf8Bytes(a);
	const bb = utf8Bytes(b);
	return ba.length - bb.length || Buffer.compare(ba, bb);
};

const resortLikeJsonb = (value: unknown): unknown => {
	if (Array.isArray(value)) return value.map(resortLikeJsonb);
	if (value && typeof value === 'object') {
		const out: Record<string, unknown> = {};
		Object.keys(value as Record<string, unknown>)
			.sort(compareJsonbKeys)
			.forEach((key) => {
				out[key] = resortLikeJsonb((value as Record<string, unknown>)[key]);
			});
		return out;
	}
	return value;
};

/** Sort keys alphabetically at every level (optionally normalizing arrays via `arrayHook`) so two states compare regardless of key order. */
const sortKeysDeep = (
	value: unknown,
	arrayHook: (key: string, list: unknown[]) => unknown[] = (_key, list) => list,
	parentKey = '',
): unknown => {
	if (Array.isArray(value)) {
		return arrayHook(parentKey, value).map((item) => sortKeysDeep(item, arrayHook, parentKey));
	}
	if (value && typeof value === 'object') {
		const out: Record<string, unknown> = {};
		Object.keys(value as Record<string, unknown>)
			.sort()
			.forEach((key) => {
				out[key] = sortKeysDeep((value as Record<string, unknown>)[key], arrayHook, key);
			});
		return out;
	}
	return value;
};

describe('state round trip through jsonb key order', () => {
	describe('resortLikeJsonb', () => {
		it('sorts keys by byte length then bytewise, recursively, and keeps arrays in order', () => {
			const result = resortLikeJsonb({
				bb: 1,
				a: 2,
				ccc: { z: 1, aa: 2 },
				list: [{ yy: 1, x: 2 }, 3, 'b', 'a'],
			}) as Record<string, any>;

			expect(Object.keys(result)).to.deep.equal(['a', 'bb', 'ccc', 'list']);
			expect(Object.keys(result.ccc)).to.deep.equal(['z', 'aa']);
			expect(Object.keys(result.list[0])).to.deep.equal(['x', 'yy']);
			expect(result.list.slice(1)).to.deep.equal([3, 'b', 'a']);
		});

		it('orders by UTF-8 bytes, not characters, and puts uppercase before lowercase', () => {
			// 'é' is one character but two bytes, so it sorts after the two one-byte keys.
			const result = resortLikeJsonb({ é: 1, ab: 2, Ab: 3, b: 4 });
			expect(Object.keys(result as object)).to.deep.equal(['b', 'Ab', 'ab', 'é']);
		});

		it('leaves primitives unchanged', () => {
			expect(resortLikeJsonb(5)).to.equal(5);
			expect(resortLikeJsonb('x')).to.equal('x');
			expect(resortLikeJsonb(null)).to.equal(null);
		});
	});

	const games: Game[] = [];
	afterEach(() => {
		games.splice(0).forEach((g) => g.dispose());
	});

	const setup = () => {
		const game = new Game({ roomId: 'roundtrip-room' });
		games.push(game);

		// Zed and Amy tie on XP and sit in opposite order in insertion and jsonb order.
		// Ids chosen so insertion order (mmmm, zz, aaa-user), alphabetical order
		// (aaa-user, mmmm, zz) and jsonb order (zz, mmmm, aaa-user) all differ.
		const zed = new Beastmaster({ name: 'Zed', xp: 100 });
		const amy = new Beastmaster({ name: 'Amy', xp: 100 });
		const bob = new Beastmaster({ name: 'Bob', xp: 50 });

		// Same givenName in different case, owned by different characters: a lookup collision.
		const zedFang = new Basilisk({ name: 'Fang', xp: 30 });
		const amyFang = new Basilisk({ name: 'fang', xp: 30 });
		// Two more monsters with equal XP so the monster ranking tie matters too.
		const zedAce = new Basilisk({ name: 'Ace', xp: 20 });
		const bobRex = new Basilisk({ name: 'Rex', xp: 20 });

		zed.addMonster(zedFang);
		zed.addMonster(zedAce);
		amy.addMonster(amyFang);
		bob.addMonster(bobRex);

		// Saved in an order that is neither alphabetical nor by length. "aggro" is inserted
		// before "Aggro", but bytewise "Aggro" < "aggro" so jsonb flips them.
		zedFang.setOptions({
			presets: {
				aggro: ['Hit'],
				Zen: ['Heal'],
				Aggro: ['Flee'],
				bal: ['Hit', 'Heal'],
			},
		});

		game.characters.mmmm = zed;
		game.characters.zz = amy;
		game.characters['aaa-user'] = bob;

		// Ledger keyed by user id: a plain object whose key order jsonb also changes.
		game.bossSummons = { 'user-long-id': [3, 4], zz: [1], mmmm: [2] };

		// `stableId` is minted lazily on first read and only then saved. Read it now, as a real
		// game does long before a save, so the two games can be compared by it.
		[zedFang, amyFang, zedAce, bobRex].forEach((monster) => monster.stableId);

		const saved = JSON.parse(JSON.stringify(game));
		const resorted = resortLikeJsonb(saved) as any;
		const restored = restoreGame(resorted, () => {});
		games.push(restored);
		expect(Object.keys(resorted.options.characters)).to.deep.equal(['zz', 'mmmm', 'aaa-user']);

		return { game, restored, saved, resorted, zedFang };
	};

	it('breaks character ranking ties the same way (Zed and Amy tie on XP)', () => {
		const { game, restored } = setup();
		expect(restored.getCreatureRankings(Object.values(restored.characters))).to.deep.equal(
			game.getCreatureRankings(Object.values(game.characters)),
		);
	});

	it('breaks monster ranking ties the same way (Ace and Rex tie on XP)', () => {
		const { game, restored } = setup();
		expect(
			restored.getCreatureRankings(Object.values(restored.getAllMonstersLookup())),
		).to.deep.equal(game.getCreatureRankings(Object.values(game.getAllMonstersLookup())));
	});

	it('ranks tied monsters the same whatever order they arrive in', () => {
		// The test above passes whenever the lookup fix holds, because both games feed rankings
		// the same order. This one guards getCreatureRankings' own tie-break.
		const { game } = setup();
		const monsters = Object.values(game.getAllMonstersLookup());
		expect(game.getCreatureRankings([...monsters].reverse())).to.deep.equal(
			game.getCreatureRankings(monsters),
		);
	});

	it('resolves a colliding monster name to the same monster', () => {
		const { game, restored } = setup();
		const before = game.getAllMonstersLookup().fang;
		const after = restored.getAllMonstersLookup().fang;
		expect(before, 'lookup should find fang').to.exist;
		expect(after.stableId).to.equal(before.stableId);
	});

	it('lists presets and resolves differently cased preset names the same way', () => {
		const { game, restored } = setup();
		// `look at presets` sorts by localeCompare (commands/presets.ts).
		const listing = (g: Game): string[] =>
			Object.keys(g.characters.mmmm.getPresets('Fang') as Record<string, string[]>).sort(
				(a, b) => a.localeCompare(b),
			);
		expect(listing(restored)).to.deep.equal(listing(game));
		expect(listing(game)).to.have.members(['aggro', 'Aggro', 'bal', 'Zen']);

		// `load preset` and `save preset` both go through resolvePresetKey.
		const resolve = (g: Game, name: string): string | undefined => {
			const character: any = g.characters.mmmm;
			return character.resolvePresetKey(character.getPresets('Fang'), name);
		};
		['AGGRO', 'aggro', 'Aggro', 'zen', 'BAL', 'nope'].forEach((name) => {
			expect(resolve(restored, name), name).to.equal(resolve(game, name));
		});
		expect(resolve(game, 'AGGRO')).to.equal('aggro');
	});

	it('loses no data when the saved state is re-sorted and restored', () => {
		const { saved } = setup();
		// `game` itself cannot be compared: a fresh game's first save omits some defaults (an empty
		// deck, `items: []`, `cards: []`) and restore fills them in (a random deck), which has
		// nothing to do with key order. So save once more from a restored game, where those
		// defaults are settled, and compare that against its own re-sorted restore.
		const settled = restoreGame(saved, () => {});
		const settledSave = JSON.parse(JSON.stringify(settled));
		const afterSort = restoreGame(resortLikeJsonb(settledSave) as Record<string, unknown>, () => {});
		games.push(settled, afterSort);
		// Restore also re-sorts each character's `deck` array by card name (an array, so not a
		// key-order effect); sort decks on both sides so that difference is not reported.
		const normalize = (state: unknown): string =>
			JSON.stringify(
				sortKeysDeep(state, (key, list) =>
					key === 'deck'
						? [...list].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
						: list,
				),
			);
		expect(normalize(JSON.parse(JSON.stringify(afterSort)))).to.equal(normalize(settledSave));
	});
});
