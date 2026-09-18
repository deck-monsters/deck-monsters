import { expect } from 'chai';
import sinon from 'sinon';

import { draw } from './draw.js';

describe('./cards/helpers/draw.ts', () => {
	const originalRandom = Math.random;
	const originalDeterministicFlag = process.env.DECK_MONSTERS_DETERMINISTIC_DRAW;

	beforeEach(() => {
		// `DECK_MONSTERS_DETERMINISTIC_DRAW` swaps the shuffle for an alphabetical sort
		// (see draw.ts), which is what makes this test deterministic without needing to
		// also control the shuffle's own randomness.
		process.env.DECK_MONSTERS_DETERMINISTIC_DRAW = '1';
	});

	afterEach(() => {
		Math.random = originalRandom;
		if (originalDeterministicFlag === undefined) {
			delete process.env.DECK_MONSTERS_DETERMINISTIC_DRAW;
		} else {
			process.env.DECK_MONSTERS_DETERMINISTIC_DRAW = originalDeterministicFlag;
		}
	});

	// `percent()` (helpers/chance.ts) is `Math.floor(Math.random() * 100) + 1`, so
	// stubbing Math.random to a fixed value pins every rarity roll to the same number —
	// verified empirically against the compiled helper before writing this test.
	const stubPercentRoll = (roll: number) => {
		const random = (roll - 1) / 100;
		sinon.stub(Math, 'random').returns(random);
	};

	it("gives a low-level creature's early drop boost the rarer card of an otherwise-tied pool", () => {
		// A fake creature that is eligible for every card (canHoldCard always true) so
		// the ONLY thing that differs between the two draws below is `earlyDropBoost`,
		// not `canHoldCard`'s own level gate (which this test deliberately does not
		// exercise — see constants/progression.ts for why that gate stays untouched).
		const lowLevelCreature = { level: 0, canHoldCard: () => true };
		// Level 5 is at/past EARLY_DROP_BOOST_CONVERGE_LEVEL, so its boost is 1x — the
		// same as "no boost at all".
		const convergedCreature = { level: 5, canHoldCard: () => true };

		// Alphabetically, the first card is AdrenalineRushCard (probability 40). Roll 45
		// fails it unboosted (40 < 45) but passes at the level-0 boost (3x, capped at
		// 100) — so only the boosted draw should return it on the very first card.
		stubPercentRoll(45);
		const boostedCard = draw({}, lowLevelCreature);
		expect(boostedCard.constructor.name).to.equal('AdrenalineRushCard');

		// Unboosted, the same roll keeps failing every card at or below 45 probability
		// until BlastCard (probability 65, still alphabetically early).
		sinon.restore();
		stubPercentRoll(45);
		const unboostedCard = draw({}, convergedCreature);
		expect(unboostedCard.constructor.name).to.equal('BlastCard');
	});

	it('never lets the boost push an eligible card above a 100% roll chance', () => {
		// A roll of 100 (the worst possible percent() result) should still draw
		// something rather than recursing forever, even at the maximum boost.
		stubPercentRoll(100);
		const creature = { level: 0, canHoldCard: () => true };
		const card = draw({}, creature);
		expect(card).to.not.equal(undefined);
	});
});
