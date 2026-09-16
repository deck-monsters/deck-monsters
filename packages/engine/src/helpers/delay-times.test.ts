import { expect } from 'chai';

import { shortDelay, subEventDelay, veryShortDelay } from './delay-times.js';

const DELAY_ENV_KEYS = [
	'DECK_MONSTERS_SKIP_DELAYS',
	'DECK_MONSTERS_SUB_EVENT_DELAY_MIDPOINT_MS',
	'DECK_MONSTERS_VERY_SHORT_DELAY_MIDPOINT_MS',
	'DECK_MONSTERS_SHORT_DELAY_MIDPOINT_MS',
	'DECK_MONSTERS_DELAY_ROUND_FACTOR_STEP',
	'DECK_MONSTERS_DELAY_ROUND_MIN_FACTOR',
	'DECK_MONSTERS_DELAY_ROUND_MAX_FACTOR',
] as const;

describe('delay-times', () => {
	const originalRandom = Math.random;
	const originalEnv: Partial<Record<(typeof DELAY_ENV_KEYS)[number], string | undefined>> = {};

	beforeEach(() => {
		for (const key of DELAY_ENV_KEYS) {
			originalEnv[key] = process.env[key];
			delete process.env[key];
		}
		Math.random = originalRandom;
	});

	afterEach(() => {
		Math.random = originalRandom;
		for (const key of DELAY_ENV_KEYS) {
			const value = originalEnv[key];
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	});

	it('samples the default ranges from the shipped midpoints when no env overrides are set', () => {
		// Defaults are 5100 (card to card) and 6000 (round to round); each range is
		// [⅔·midpoint, 4/3·midpoint]. `short` was lowered from 7650 because round
		// transitions were measured as the longest gaps in a live feed.
		Math.random = () => 0;
		expect(veryShortDelay()).to.equal(3400);
		expect(shortDelay()).to.equal(4000);

		Math.random = () => 0.999999;
		expect(veryShortDelay()).to.equal(6800);
		expect(shortDelay()).to.equal(8000);
	});

	it('uses midpoint env vars to derive min and max ranges', () => {
		process.env.DECK_MONSTERS_VERY_SHORT_DELAY_MIDPOINT_MS = '3000';
		process.env.DECK_MONSTERS_SHORT_DELAY_MIDPOINT_MS = '4500';

		Math.random = () => 0;
		expect(veryShortDelay()).to.equal(2000);
		expect(shortDelay()).to.equal(3000);

		Math.random = () => 0.999999;
		expect(veryShortDelay()).to.equal(4000);
		expect(shortDelay()).to.equal(6000);
	});

	it('supports round-based pacing shaping with factor caps', () => {
		process.env.DECK_MONSTERS_DELAY_ROUND_FACTOR_STEP = '0.5';
		process.env.DECK_MONSTERS_DELAY_ROUND_MIN_FACTOR = '0.5';
		process.env.DECK_MONSTERS_DELAY_ROUND_MAX_FACTOR = '1.2';

		Math.random = () => 0;
		// Base veryShort min is 3400ms (⅔ of the 5100 default midpoint). Round 3 =>
		// factor 1 + 0.5 * 2 = 2.0, capped to 1.2 => 4080ms.
		expect(veryShortDelay(3)).to.equal(4080);
	});

	it('returns zero delays when delay skipping is enabled', () => {
		process.env.DECK_MONSTERS_SKIP_DELAYS = '1';
		Math.random = () => 0.999999;
		expect(veryShortDelay(9)).to.equal(0);
		expect(shortDelay(9)).to.equal(0);
	});

	it('subEventDelay resolves immediately when skipping', async () => {
		process.env.DECK_MONSTERS_SKIP_DELAYS = '1';
		const start = Date.now();
		await subEventDelay();
		expect(Date.now() - start).to.be.lessThan(50);
	});

	// Sets the midpoint explicitly, so this covers the env override rather than the
	// shipped default (1700ms).
	it('subEventDelay honours its midpoint env var when not skipping', async () => {
		process.env.DECK_MONSTERS_SUB_EVENT_DELAY_MIDPOINT_MS = '1000';
		Math.random = () => 0;
		const start = Date.now();
		await subEventDelay();
		const elapsed = Date.now() - start;
		expect(elapsed).to.be.at.least(650);
		expect(elapsed).to.be.at.most(1400);
	});
});
