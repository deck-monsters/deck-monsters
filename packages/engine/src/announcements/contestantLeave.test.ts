import { expect } from 'chai';

import { announceContestantLeave } from './contestantLeave.js';
import { RING_PATRON } from '../constants/lore.js';

function capture() {
	const published: Array<{ text: string }> = [];
	return {
		eb: { publish: (event: { text: string }) => published.push(event) } as any,
		published,
	};
}

function makeContestant({ isBoss }: { isBoss: boolean }) {
	return {
		isBoss,
		character: { givenName: 'Thunder Smasher', icon: '⛄', identity: '⛄ Thunder Smasher' },
		monster: { givenName: 'Dalfi', creatureType: 'Minotaur' },
	};
}

describe('announceContestantLeave', () => {
	// "Was summoned FROM the ring" said the opposite of what happened.
	it('never says a departing monster was summoned', () => {
		const { eb, published } = capture();
		announceContestantLeave(eb, 'Ring', {}, { contestant: makeContestant({ isBoss: false }) });

		expect(published).to.have.lengthOf(1);
		expect(published[0]!.text).to.not.include('summoned');
	});

	// Arrivals read "answers the call of", so both halves share one verb.
	it("calls a player's monster back, pairing with the arrival line", () => {
		const { eb, published } = capture();
		announceContestantLeave(eb, 'Ring', {}, { contestant: makeContestant({ isBoss: false }) });

		expect(published[0]!.text).to.equal(
			'Dalfi is called back from the ring by ⛄ Thunder Smasher.',
		);
	});

	// The owner is randomly generated for a boss, so naming it invents a beastmaster —
	// the same bug as #102, which was only ever fixed on the arrival side.
	it('credits the house when a boss leaves, not its generated owner', () => {
		const { eb, published } = capture();
		announceContestantLeave(eb, 'Ring', {}, { contestant: makeContestant({ isBoss: true }) });

		expect(published[0]!.text).to.not.include('Thunder Smasher');
		expect(published[0]!.text).to.include(RING_PATRON);
	});
});
