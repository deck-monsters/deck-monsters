import { expect } from 'chai';

import { announceDeath } from './death.js';

describe('./announcements/death.ts', () => {
	it('adds plain combat data for a death', () => {
		const published: Array<{ payload: Record<string, unknown> }> = [];
		const eb = {
			publish: (event: { payload: Record<string, unknown> }) => published.push(event),
		};
		const monster = {
			givenName: 'Target',
			creatureType: 'Minotaur',
			icon: '🐂',
			isBoss: false,
			identity: '🐂 Target',
			identityWithHp: '🐂 Target (0 hp)',
			pronouns: { his: 'their' },
		};
		const assailant = {
			givenName: 'Attacker',
			creatureType: 'Basilisk',
			icon: '🐍',
			isBoss: true,
			identityWithHp: '🐍 Attacker (10 hp)',
		};

		announceDeath(eb as never, '', monster, { assailant, destroyed: true });

		const combat = published[0]?.payload.combat;
		expect(combat).to.deep.equal({
			kind: 'death',
			target: { name: 'Target', creatureType: 'Minotaur', icon: '🐂', isBoss: false },
			actor: { name: 'Attacker', creatureType: 'Basilisk', icon: '🐍', isBoss: true },
			destroyed: true,
		});
		expect(JSON.parse(JSON.stringify(combat))).to.deep.equal(combat);
	});
});
