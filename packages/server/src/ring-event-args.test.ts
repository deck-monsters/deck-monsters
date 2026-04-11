import { expect } from 'chai';

import { extractRingAddContestant } from './ring-event-args.js';

describe('extractRingAddContestant', () => {
	it('reads contestant from BaseClass event args', () => {
		const contestant = extractRingAddContestant([
			'Ring',
			{ any: 'instance' },
			{ contestant: { isBoss: true, userId: 'u1' } },
		]);

		expect(contestant?.isBoss).to.equal(true);
		expect(contestant?.userId).to.equal('u1');
	});

	it('reads contestant from direct payload args', () => {
		const contestant = extractRingAddContestant([{ contestant: { isBoss: false, userId: 'u2' } }]);

		expect(contestant?.isBoss).to.equal(false);
		expect(contestant?.userId).to.equal('u2');
	});

	it('returns undefined for malformed args', () => {
		expect(extractRingAddContestant([])).to.equal(undefined);
		expect(extractRingAddContestant(['Ring', {}])).to.equal(undefined);
	});
});
