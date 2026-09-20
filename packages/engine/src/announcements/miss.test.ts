import { expect } from 'chai';

import { announceMiss } from './miss.js';

function makeCreature(name: string) {
	return {
		givenName: name,
		creatureType: 'Gladiator',
		icon: '💪',
		isBoss: false,
		dead: false,
		gender: 'male',
		pronouns: { him: 'him' },
	};
}

function capture() {
	const published: Array<{ payload: Record<string, unknown> }> = [];
	return {
		eb: {
			publish: (event: { payload: Record<string, unknown> }) => published.push(event),
		} as any,
		published,
	};
}

describe('./announcements/miss.ts', () => {
	it('adds plain combat data for a blocked miss', () => {
		const { eb, published } = capture();
		const player = makeCreature('Attacker');
		const target = makeCreature('Target');

		announceMiss(eb, '', {}, { attackResult: 6, curseOfLoki: false, player, target });

		const combat = published[0]?.payload.combat;
		expect(combat).to.deep.equal({
			kind: 'miss',
			actor: { name: 'Attacker', creatureType: 'Gladiator', icon: '💪', isBoss: false },
			target: { name: 'Target', creatureType: 'Gladiator', icon: '💪', isBoss: false },
			blocked: true,
		});
		expect(JSON.parse(JSON.stringify(combat))).to.deep.equal(combat);
	});

	it('marks a curse-of-Loki miss as unblocked', () => {
		const { eb, published } = capture();
		const player = makeCreature('Attacker');
		const target = makeCreature('Target');

		announceMiss(eb, '', {}, { attackResult: 6, curseOfLoki: true, player, target });

		expect(published[0]?.payload.combat).to.deep.equal({
			kind: 'miss',
			actor: { name: 'Attacker', creatureType: 'Gladiator', icon: '💪', isBoss: false },
			target: { name: 'Target', creatureType: 'Gladiator', icon: '💪', isBoss: false },
			blocked: false,
		});
	});
});
