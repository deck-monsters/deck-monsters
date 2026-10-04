import { expect } from 'chai';

import Basilisk from './basilisk.js';
import { monsterCard } from '../helpers/card.js';
import { TARGET_LOWEST_HP_PLAYER } from '../helpers/targeting-strategies.js';

describe('monster strategy label', () => {
	// New-player walk 2 #8: `Strategy: You target ...` addressed the player, who is not the
	// one targeting. The label now names whose orders they are.
	it("labels the strategy line with the monster's name", () => {
		const monster = new Basilisk({ name: 'Rex', targetingStrategy: TARGET_LOWEST_HP_PLAYER });
		expect(monster.stats).to.include(`\n${monster.givenName}'s orders: `);
		expect(monster.stats).to.not.include('Strategy:');
	});

	it('uses a bare apostrophe for a name ending in s', () => {
		const monster = new Basilisk({ name: 'Rex', targetingStrategy: TARGET_LOWEST_HP_PLAYER });
		Object.defineProperty(monster, 'givenName', { value: 'Moss' });
		expect(monster.stats).to.include("Moss' orders: ");
	});

	it("shows a player monster's record on its card but not a boss's", () => {
		const player = new Basilisk({ name: 'Rex' });
		const boss = new Basilisk({ name: 'Rex', isBoss: true });
		expect(monsterCard(player as never, true)).to.include('Fights:');
		expect(monsterCard(boss as never, true)).to.not.include('Fights:');
	});
});
