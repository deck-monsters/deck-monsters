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

	it('reports a plain (non-destroyed) death with the same shape', () => {
		const published: Array<{ payload: Record<string, unknown>; text: string }> = [];
		const eb = {
			publish: (event: { payload: Record<string, unknown>; text: string }) => published.push(event),
		};
		const monster = {
			givenName: 'Target',
			creatureType: 'Minotaur',
			icon: '🐂',
			identity: '🐂 Target',
			identityWithHp: '🐂 Target (0 hp)',
			pronouns: { his: 'their' },
		};
		const assailant = {
			givenName: 'Attacker',
			creatureType: 'Basilisk',
			icon: '🐍',
			identityWithHp: '🐍 Attacker (10 hp)',
		};

		announceDeath(eb as never, '', monster, { assailant, destroyed: false });

		expect(published[0]?.text).to.equal('💀  🐂 Target (0 hp) is killed by 🐍 Attacker (10 hp)\n');
		const combat = published[0]?.payload.combat;
		expect(combat).to.deep.equal({
			kind: 'death',
			target: { name: 'Target', creatureType: 'Minotaur', icon: '🐂', isBoss: false },
			actor: { name: 'Attacker', creatureType: 'Basilisk', icon: '🐍', isBoss: false },
			destroyed: false,
		});
		expect(JSON.parse(JSON.stringify(combat))).to.deep.equal(combat);
	});
});
