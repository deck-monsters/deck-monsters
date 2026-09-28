import { expect } from 'chai';

import Basilisk from '../monsters/basilisk.js';
import { STARTING_XP } from '../helpers/experience.js';

describe('creatures/stats', () => {
	let monsters: Basilisk[] = [];

	afterEach(() => {
		for (const monster of monsters) {
			monster.disposeTimers();
		}
		monsters = [];
	});

	function makeBasilisk (options: Record<string, unknown> = {}): Basilisk {
		const monster = new Basilisk(options);
		monsters.push(monster);
		return monster;
	}

	it('returns STARTING_XP (0) for a new monster with xp 0', () => {
		const monster = makeBasilisk({ xp: 0 });

		expect(monster.xp).to.equal(STARTING_XP);
		expect(monster.xp).to.equal(0);
	});

	it('returns STARTING_XP (0) for a new monster with undefined xp', () => {
		const monster = makeBasilisk();

		expect(monster.xp).to.equal(STARTING_XP);
		expect(monster.xp).to.equal(0);
	});

	it('stores exactly 10 after monster.xp += 10 from 0 (not 11)', () => {
		const monster = makeBasilisk({ xp: 0 });

		monster.xp += 10;

		expect(monster.options.xp).to.equal(10);
		expect(monster.xp).to.equal(10);
	});

	it('still floors AC and STR at minimum 1', () => {
		const monster = makeBasilisk();

		monster.encounterModifiers = {
			...monster.encounterModifiers,
			ac: -1000,
			str: -1000,
		};

		expect(monster.ac).to.equal(1);
		expect(monster.str).to.equal(1);
	});

	// xp 113 is the discounted level-3 threshold (helpers/levels.ts). The encounter
	// delta must move the raw stat and the modifier cards add to rolls by the same
	// amount, once. Counting it in both getPreBattlePropValue and getProp made the
	// raw stat jump by two.
	it('applies an encounter DEX boost once to both raw DEX and its modifier', () => {
		const monster = makeBasilisk({ xp: 113 });
		const raw = monster.dex;
		const modifier = monster.dexModifier;
		monster.setModifier('dex', 1);
		expect(monster.dex).to.equal(raw + 1);
		expect(monster.dexModifier).to.equal(modifier + 1);
	});

	it('applies an encounter STR curse once to both raw STR and its modifier', () => {
		const monster = makeBasilisk({ xp: 113 });
		const raw = monster.str;
		const modifier = monster.strModifier;
		monster.setModifier('str', -1);
		expect(monster.str).to.equal(raw - 1);
		expect(monster.strModifier).to.equal(modifier - 1);
	});

	it('applies an encounter INT boost once to both raw INT and its modifier', () => {
		const monster = makeBasilisk({ xp: 113 });
		const raw = monster.int;
		const modifier = monster.intModifier;
		monster.setModifier('int', 1);
		expect(monster.int).to.equal(raw + 1);
		expect(monster.intModifier).to.equal(modifier + 1);
	});
});

describe('youth AC (roadmap 35)', () => {
	it('gives the full amount to level 3, half (rounded up) to level 6, and none from 7', async () => {
		const { youthAcBonus } = await import('./stats.js');
		expect([0, 1, 2, 3, 4, 5, 6, 7, 10, 20].map(level => youthAcBonus(level, 2))).to.deep.equal([2, 2, 2, 2, 1, 1, 1, 0, 0, 0]);
		expect(youthAcBonus(1)).to.equal(0);
	});

	it('raises a young Dragon and Gladiator AC, and leaves an old one and other monsters alone', async () => {
		const { default: Dragon } = await import('../monsters/dragon.js');
		const { default: Gladiator } = await import('../monsters/gladiator.js');
		const { default: Minotaur } = await import('../monsters/minotaur.js');
		const { getXpCapForLevel } = await import('../ring/index.js');
		const ac = (M: any, level: number): number => {
			const m = new M({ name: 'probe', acVariance: 0, xp: getXpCapForLevel(level) });
			const value = m.ac;
			m.disposeTimers();
			return value;
		};
		// Same instance roll (acVariance 0): the young one is exactly the youth bonus ahead of
		// what the class's static AC and level alone give.
		for (const M of [Dragon, Gladiator]) {
			expect(ac(M, 1) - ac(Minotaur, 1) - ((M as any).acVariance ?? 0) + ((Minotaur as any).acVariance ?? 0)).to.equal(2);
			expect(ac(M, 5) - ac(Minotaur, 5) - ((M as any).acVariance ?? 0) + ((Minotaur as any).acVariance ?? 0)).to.equal(1);
			expect(ac(M, 8) - ac(Minotaur, 8) - ((M as any).acVariance ?? 0) + ((Minotaur as any).acVariance ?? 0)).to.equal(0);
		}
	});
});
