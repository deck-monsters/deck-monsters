import { expect } from 'chai';
import sinon from 'sinon';

import {
	noteEmitted,
	lastEmittedShape,
	msSinceLastEmit,
	resetPacingContext,
} from './pacing-context.js';
import { subEventDelayMs, remainingGapMs, groupedBeatMs } from './delay-times.js';

const DELAY_ENV = [
	'DECK_MONSTERS_SKIP_DELAYS',
	'DECK_MONSTERS_READING_SCALE_PER_LINE',
	'DECK_MONSTERS_READING_SCALE_MAX',
	'DECK_MONSTERS_SUB_EVENT_DELAY_MIDPOINT_MS',
	'DECK_MONSTERS_MAX_FEED_GAP_MS',
	'DECK_MONSTERS_GROUPED_BEAT_MS',
];

describe('helpers/pacing-context.ts', () => {
	const saved: Record<string, string | undefined> = {};
	let originalRandom: () => number;

	beforeEach(() => {
		originalRandom = Math.random;
		for (const key of DELAY_ENV) saved[key] = process.env[key];
		// These tests exercise real (non-skipped) pacing maths.
		delete process.env.DECK_MONSTERS_SKIP_DELAYS;
		resetPacingContext();
	});

	afterEach(() => {
		Math.random = originalRandom;
		for (const key of DELAY_ENV) {
			const value = saved[key];
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
		resetPacingContext();
		sinon.restore();
	});

	it('records the rendered line count, ignoring blank lines', () => {
		noteEmitted('one\n\ntwo\n   \nthree\n');
		expect(lastEmittedShape()?.lines).to.equal(3);
	});

	it('ignores an empty message so pacing keeps the previous shape', () => {
		noteEmitted('a\nb');
		noteEmitted('   ');
		expect(lastEmittedShape()?.lines).to.equal(2);
	});

	it('reports nothing before anything has been emitted', () => {
		expect(lastEmittedShape()).to.equal(undefined);
		expect(msSinceLastEmit()).to.equal(0);
	});

	describe('content-proportional sub-event pacing', () => {
		it('pauses longer after a long block than after a one-line result', () => {
			Math.random = () => 0.5;

			noteEmitted('single line');
			const short = subEventDelayMs();

			noteEmitted(Array.from({ length: 10 }, (_, i) => `line ${i}`).join('\n'));
			const long = subEventDelayMs();

			// The ten-line card box is the thing that actually needs reading time; before
			// this it got exactly the same pause as "🎲 *4*".
			expect(long).to.be.greaterThan(short);
		});

		it('caps the scale so a huge stat block cannot stall the feed', () => {
			Math.random = () => 0.5;
			process.env.DECK_MONSTERS_READING_SCALE_MAX = '2';

			noteEmitted('single line');
			const base = subEventDelayMs();

			noteEmitted(Array.from({ length: 200 }, (_, i) => `line ${i}`).join('\n'));
			const huge = subEventDelayMs();

			expect(huge).to.be.at.most(base * 2 + 1);
		});

		it('falls back to flat pacing when the per-line scale is zero', () => {
			Math.random = () => 0.5;
			process.env.DECK_MONSTERS_READING_SCALE_PER_LINE = '0';

			noteEmitted('single line');
			const short = subEventDelayMs();
			noteEmitted(Array.from({ length: 12 }, (_, i) => `line ${i}`).join('\n'));
			const long = subEventDelayMs();

			expect(long).to.equal(short);
		});
	});

	describe('remainingGapMs', () => {
		it('subtracts time already elapsed so successive waits do not stack', () => {
			const clock = sinon.useFakeTimers({ now: 10_000, toFake: ['Date'] });
			try {
				noteEmitted('something');
				clock.tick(2000);
				expect(remainingGapMs(5000)).to.equal(3000);
			} finally {
				clock.restore();
			}
		});

		it('never returns a negative wait when the gap is already covered', () => {
			const clock = sinon.useFakeTimers({ now: 10_000, toFake: ['Date'] });
			try {
				noteEmitted('something');
				clock.tick(9000);
				expect(remainingGapMs(5000)).to.equal(0);
			} finally {
				clock.restore();
			}
		});

		it('clamps to the feed-gap ceiling so the fight never reads as stalled', () => {
			process.env.DECK_MONSTERS_MAX_FEED_GAP_MS = '8000';
			resetPacingContext();
			expect(remainingGapMs(30_000)).to.equal(8000);
		});

		it('returns zero in skip mode so tests and the harness stay instant', () => {
			process.env.DECK_MONSTERS_SKIP_DELAYS = '1';
			noteEmitted('something');
			expect(remainingGapMs(5000)).to.equal(0);
			expect(subEventDelayMs()).to.equal(0);
			expect(groupedBeatMs()).to.equal(0);
		});
	});

	describe('groupedBeatMs', () => {
		it('is much shorter than a sub-event pause, so grouped lines read as one unit', () => {
			Math.random = () => 0.5;
			noteEmitted('a single line');
			expect(groupedBeatMs()).to.be.lessThan(subEventDelayMs());
		});
	});
});
