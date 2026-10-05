import { expect } from 'chai';

import allMonsters from './all.js';
import { levelUpGains } from './level-up.js';
import { discountedLevelThreshold } from '../../helpers/levels.js';

type Stats = { maxHp: number; ac: number; str: number; dex: number; int: number; level: number };

describe('monsters/helpers/level-up', () => {
	// The gains are computed from formulas, so check them against what a real monster's stats
	// actually do between two levels: if the stat code changes, this fails rather than the
	// Workshop quietly promising the wrong numbers.
	it('matches the change in a real monster\'s stats, for every type and levels 0 to 20', () => {
		for (const Monster of allMonsters) {
			const at = (level: number): Stats =>
				new (Monster as any)({ xp: discountedLevelThreshold(level), hpVariance: 0, acVariance: 0 }) as Stats;
			for (let level = 0; level <= 20; level += 1) {
				const before = at(level);
				const after = at(level + 1);
				expect(before.level, `${Monster.name} at ${level}`).to.equal(level);
				const type = (Monster as any).creatureType as string;
				expect(levelUpGains(type, level), `${type} ${level} -> ${level + 1}`).to.deep.equal({
					level: level + 1,
					hp: after.maxHp - before.maxHp,
					ac: after.ac - before.ac,
					str: after.str - before.str,
					dex: after.dex - before.dex,
					int: after.int - before.int,
				});
			}
		}
	});

	it('shows a Dragon\'s youth AC shrinking at level 4 as a loss, not as nothing', () => {
		expect(levelUpGains('Dragon', 3).ac).to.equal(0); // +1 level AC, -1 youth AC
		expect(levelUpGains('Basilisk', 3).ac).to.equal(1);
	});

	it('treats an unknown type as having no youth bonus', () => {
		expect(levelUpGains('Mystery', 0)).to.deep.equal({ level: 1, hp: 3, ac: 1, str: 1, dex: 1, int: 1 });
	});
});
