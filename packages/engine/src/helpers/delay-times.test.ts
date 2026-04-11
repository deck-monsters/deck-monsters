import { expect } from 'chai';

import { shortDelay, veryShortDelay } from './delay-times.js';

const DELAY_ENV_KEYS = [
	'DECK_MONSTERS_SKIP_DELAYS',
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

	it('keeps default ranges unchanged when no env overrides are set', () => {
		Math.random = () => 0;
		expect(veryShortDelay()).to.equal(1000);
		expect(shortDelay()).to.equal(1500);

		Math.random = () => 0.999999;
		expect(veryShortDelay()).to.equal(2000);
		expect(shortDelay()).to.equal(3000);
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
		// Base veryShort min is 1000ms. Round 3 => factor 1 + 0.5 * 2 = 2.0, capped to 1.2.
		expect(veryShortDelay(3)).to.equal(1200);
	});

	it('returns zero delays when delay skipping is enabled', () => {
		process.env.DECK_MONSTERS_SKIP_DELAYS = '1';
		Math.random = () => 0.999999;
		expect(veryShortDelay(9)).to.equal(0);
		expect(shortDelay(9)).to.equal(0);
	});
});
