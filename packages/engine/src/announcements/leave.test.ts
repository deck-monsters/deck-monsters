import { expect } from 'chai';

import { announceLeave } from './leave.js';

describe('./announcements/leave.ts', () => {
	it('adds plain combat data for a fleeing monster', () => {
		const published: Array<{ payload: Record<string, unknown> }> = [];
		const eb = {
			publish: (event: { payload: Record<string, unknown> }) => published.push(event),
		};
		const monster = {
			givenName: 'Fleeing',
			creatureType: 'Weeping Angel',
			icon: '👼',
			isBoss: false,
			identityWithHp: '👼 Fleeing (3 hp)',
		};

		announceLeave(eb as never, '', monster, { activeContestants: [{ monster }] });

		const combat = published[0]?.payload.combat;
		expect(combat).to.deep.equal({
			kind: 'flee',
			actor: { name: 'Fleeing', creatureType: 'Weeping Angel', icon: '👼', isBoss: false },
		});
		expect(JSON.parse(JSON.stringify(combat))).to.deep.equal(combat);
	});
});
