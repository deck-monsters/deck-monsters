import { expect } from 'chai';

import {
	BOSS_SUMMON_LIMIT,
	BOSS_SUMMON_WINDOW_MS,
	recordSummon,
	summonAllowance,
	addPendingSummon,
	refundPendingSummons,
	type BossSummonLedger,
} from './boss-summons.js';

const USER = 'user-1';
const OTHER_USER = 'user-2';
const NOW = 1_700_000_000_000;

describe('helpers/boss-summons.ts', () => {
	it('allows the full limit to a player who has never summoned', () => {
		const allowance = summonAllowance(undefined, USER, NOW);

		expect(allowance.allowed).to.equal(true);
		expect(allowance.used).to.equal(0);
		expect(allowance.remaining).to.equal(BOSS_SUMMON_LIMIT);
		expect(allowance.nextAvailableAt).to.equal(null);
	});

	it('counts down to the limit and then refuses', () => {
		let ledger: BossSummonLedger | undefined;

		for (let i = 0; i < BOSS_SUMMON_LIMIT; i++) {
			expect(summonAllowance(ledger, USER, NOW).allowed).to.equal(true);
			ledger = recordSummon(ledger, USER, NOW + i);
		}

		const allowance = summonAllowance(ledger, USER, NOW + BOSS_SUMMON_LIMIT);

		expect(allowance.allowed).to.equal(false);
		expect(allowance.remaining).to.equal(0);
		expect(allowance.used).to.equal(BOSS_SUMMON_LIMIT);
	});

	it('reports when the next charge unlocks, based on the oldest summon in the window', () => {
		let ledger = recordSummon(undefined, USER, NOW);
		ledger = recordSummon(ledger, USER, NOW + 1000);
		ledger = recordSummon(ledger, USER, NOW + 2000);

		const allowance = summonAllowance(ledger, USER, NOW + 3000);

		expect(allowance.nextAvailableAt).to.equal(NOW + BOSS_SUMMON_WINDOW_MS);
	});

	it('frees a charge once the oldest summon rolls out of the 24h window', () => {
		let ledger: BossSummonLedger | undefined;
		for (let i = 0; i < BOSS_SUMMON_LIMIT; i++) {
			ledger = recordSummon(ledger, USER, NOW + i);
		}

		// Just before the oldest expires, still refused.
		expect(
			summonAllowance(ledger, USER, NOW + BOSS_SUMMON_WINDOW_MS - 1).allowed
		).to.equal(false);
		// The window boundary is exclusive, so the charge is back exactly when
		// `nextAvailableAt` says it will be.
		const allowance = summonAllowance(ledger, USER, NOW + BOSS_SUMMON_WINDOW_MS);
		expect(allowance.allowed).to.equal(true);
		expect(allowance.remaining).to.equal(1);
	});

	it('keeps players independent of one another', () => {
		let ledger: BossSummonLedger | undefined;
		for (let i = 0; i < BOSS_SUMMON_LIMIT; i++) {
			ledger = recordSummon(ledger, USER, NOW + i);
		}

		expect(summonAllowance(ledger, USER, NOW).allowed).to.equal(false);
		expect(summonAllowance(ledger, OTHER_USER, NOW).allowed).to.equal(true);
		expect(summonAllowance(ledger, OTHER_USER, NOW).remaining).to.equal(BOSS_SUMMON_LIMIT);
	});

	it('prunes expired timestamps for every player when recording', () => {
		const stale: BossSummonLedger = {
			[OTHER_USER]: [NOW - BOSS_SUMMON_WINDOW_MS - 1],
			[USER]: [NOW - BOSS_SUMMON_WINDOW_MS - 1, NOW - 10],
		};

		const ledger = recordSummon(stale, USER, NOW);

		expect(ledger[OTHER_USER]).to.equal(undefined);
		expect(ledger[USER]).to.deep.equal([NOW - 10, NOW]);
	});

	it('ignores junk entries rather than counting them as summons', () => {
		const ledger = {
			[USER]: [null, 'nonsense', Number.NaN, NOW - 10],
		} as unknown as BossSummonLedger;

		expect(summonAllowance(ledger, USER, NOW).used).to.equal(1);
	});

	describe('pending summons (Finding 6 — restart-gap refund)', () => {
		it('refundPendingSummons removes pending timestamps from the main ledger', () => {
			const main: BossSummonLedger = { [USER]: [NOW, NOW + 1000] };
			const pending: BossSummonLedger = { [USER]: [NOW + 1000] }; // second summon is pending

			const { ledger: refunded, pending: clearedPending } = refundPendingSummons(main, pending);

			expect(refunded[USER]).to.deep.equal([NOW]); // only the finalized one remains
			expect(clearedPending[USER]).to.equal(undefined); // pending cleared
		});

		it('refundPendingSummons returns unchanged ledger when there are no pending summons', () => {
			const main: BossSummonLedger = { [USER]: [NOW, NOW + 1000] };
			const pending: BossSummonLedger = {};

			const { ledger: refunded } = refundPendingSummons(main, pending);

			expect(refunded[USER]).to.deep.equal([NOW, NOW + 1000]);
		});

		it('refundPendingSummons handles a user whose entire ledger entry is pending', () => {
			const main: BossSummonLedger = { [USER]: [NOW] };
			const pending: BossSummonLedger = { [USER]: [NOW] };

			const { ledger: refunded } = refundPendingSummons(main, pending);

			expect(refunded[USER]).to.equal(undefined);
		});

		it('refundPendingSummons does not affect other users', () => {
			const main: BossSummonLedger = { [USER]: [NOW], [OTHER_USER]: [NOW + 500] };
			const pending: BossSummonLedger = { [USER]: [NOW] };

			const { ledger: refunded } = refundPendingSummons(main, pending);

			expect(refunded[USER]).to.equal(undefined);
			expect(refunded[OTHER_USER]).to.deep.equal([NOW + 500]);
		});

		it('addPendingSummon adds a timestamp to the pending ledger', () => {
			const pending = addPendingSummon(undefined, USER, NOW);

			expect(pending[USER]).to.deep.equal([NOW]);
		});

		it('addPendingSummon accumulates multiple pending summons', () => {
			let pending = addPendingSummon(undefined, USER, NOW);
			pending = addPendingSummon(pending, USER, NOW + 1000);

			expect(pending[USER]).to.deep.equal([NOW, NOW + 1000]);
		});
	});
});
