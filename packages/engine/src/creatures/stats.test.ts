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
});
