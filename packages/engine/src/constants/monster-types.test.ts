import { expect } from 'chai';

import { MONSTER_TYPES } from './monster-types.js';
import { allMonsters } from '../monsters/helpers/all.js';

describe('./constants/monster-types.ts', () => {
	it('names every trainable monster type, so matchup cards can call the rest neutral', () => {
		const registered = allMonsters.map((Monster: any) => Monster.creatureType).sort();
		expect([...MONSTER_TYPES].sort()).to.deep.equal(registered);
	});
});
