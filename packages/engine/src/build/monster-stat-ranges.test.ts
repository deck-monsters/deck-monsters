import { expect } from 'chai';

import Basilisk from '../monsters/basilisk.js';
import Jinn from '../monsters/jinn.js';
import Minotaur from '../monsters/minotaur.js';
import {
	acRangeAtLevel,
	hpRangeAtLevel,
	spawnVarianceRange,
} from './monster-stat-ranges.js';

describe('monster-stat-ranges', () => {
	it('models spawn variance as random(0, global) + type offset', () => {
		expect(spawnVarianceRange(2, 5)).to.deep.equal({ min: 2, max: 7 });
		expect(spawnVarianceRange(-1, 2)).to.deep.equal({ min: -1, max: 1 });
	});

	it('Basilisk HP/AC at spawn match engine semantics', () => {
		expect(hpRangeAtLevel(2, 0)).to.deep.equal({ min: 30, max: 35 });
		expect(acRangeAtLevel(2, 0)).to.deep.equal({ min: 7, max: 9 });
	});

	it('Jinn HP/AC at spawn match engine semantics', () => {
		expect(hpRangeAtLevel(0, 0)).to.deep.equal({ min: 28, max: 33 });
		expect(acRangeAtLevel(2, 0)).to.deep.equal({ min: 7, max: 9 });
	});

	it('Minotaur HP/AC at spawn match engine semantics', () => {
		expect(hpRangeAtLevel(4, 0)).to.deep.equal({ min: 32, max: 37 });
		expect(acRangeAtLevel(-1, 0)).to.deep.equal({ min: 4, max: 6 });
	});

	it('never produces inverted HP/AC ranges for documented monster types', () => {
		for (const Monster of [Basilisk, Jinn, Minotaur]) {
			const typeHp = (Monster as any).hpVariance ?? 0;
			const typeAc = (Monster as any).acVariance ?? 0;

			for (const level of [0, 1, 3, 6]) {
				const hp = hpRangeAtLevel(typeHp, level);
				const ac = acRangeAtLevel(typeAc, level);
				expect(hp.min, `${Monster.name} hp L${level}`).to.be.at.most(hp.max);
				expect(ac.min, `${Monster.name} ac L${level}`).to.be.at.most(ac.max);
			}
		}
	});

	it('applies level scaling to HP and AC', () => {
		expect(hpRangeAtLevel(2, 3)).to.deep.equal({ min: 39, max: 44 });
		expect(acRangeAtLevel(2, 3)).to.deep.equal({ min: 10, max: 12 });
	});
});
