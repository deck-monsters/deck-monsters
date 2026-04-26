export const ONE_MINUTE = 60000;

type DelayKind = 'very_short' | 'short' | 'medium' | 'long';

// Default pacing values (roughly doubled from legacy) to make ring fights easier
// to follow in live feeds:
// - very_short: 2000–4000ms (midpoint 3000)
// - short:      3000–6000ms (midpoint 4500)
// - medium:     4000–8000ms (midpoint 6000)
// - long:       6000–12000ms (midpoint 9000)
const DEFAULT_MIDPOINTS: Record<DelayKind, number> = {
	very_short: 3000,
	short: 4500,
	medium: 6000,
	long: 9000,
};

const MIDPOINT_ENV: Record<DelayKind, string> = {
	very_short: 'DECK_MONSTERS_VERY_SHORT_DELAY_MIDPOINT_MS',
	short: 'DECK_MONSTERS_SHORT_DELAY_MIDPOINT_MS',
	medium: 'DECK_MONSTERS_MEDIUM_DELAY_MIDPOINT_MS',
	long: 'DECK_MONSTERS_LONG_DELAY_MIDPOINT_MS',
};

const CAP_ENV: Record<DelayKind, string> = {
	very_short: 'DECK_MONSTERS_VERY_SHORT_DELAY_CAP_MS',
	short: 'DECK_MONSTERS_SHORT_DELAY_CAP_MS',
	medium: 'DECK_MONSTERS_MEDIUM_DELAY_CAP_MS',
	long: 'DECK_MONSTERS_LONG_DELAY_CAP_MS',
};

// When DECK_MONSTERS_SKIP_DELAYS=1 all delay functions return 0.  Set this in
// test environments so fight tests complete in milliseconds instead of seconds.
// Checked at call time (not module load time) so the env var can be set in a
// test-setup file that is evaluated before any spec file runs.
const skip = (): boolean => !!process.env.DECK_MONSTERS_SKIP_DELAYS;

/** True when `DECK_MONSTERS_SKIP_DELAYS` is set (harness / tests): pacing timers are zeroed. */
export const delaysAreSkipped = (): boolean => skip();

let hitLogMonotonic = 0;

/**
 * Timestamps for `hitLog` entries. Realtime uses `Date.now()`; harness mode uses a
 * monotonic counter so `DelayedHit` and similar effects do not depend on wall-clock
 * ordering (which breaks reproducible simulations).
 */
export const hitLogTimestamp = (): number => (skip() ? ++hitLogMonotonic : Date.now());

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
	if (!value) return fallback;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
	return parsed;
};

const parseFloatWithDefault = (value: string | undefined, fallback: number): number => {
	if (!value) return fallback;
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : fallback;
};

const getMidpoint = (kind: DelayKind): number =>
	parsePositiveInt(process.env[MIDPOINT_ENV[kind]], DEFAULT_MIDPOINTS[kind]);

const getCap = (kind: DelayKind): number | undefined => {
	const value = process.env[CAP_ENV[kind]];
	if (!value) return undefined;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
	return parsed;
};

const getRangeFromMidpoint = (midpoint: number): { min: number; max: number } => ({
	min: Math.max(1, Math.round(midpoint * (2 / 3))),
	max: Math.max(1, Math.round(midpoint * (4 / 3))),
});

const sampleInRange = (min: number, max: number): number => {
	const span = max - min + 1;
	return Math.floor(Math.random() * span) + min;
};

const applyRoundShaping = (delayMs: number, round: number): number => {
	// Optional pacing controls (disabled by default):
	// factor = 1 + step * (round - 1), clamped to [minFactor, maxFactor].
	// Example: step=-0.08 speeds later rounds; step=+0.08 slows later rounds.
	const step = parseFloatWithDefault(
		process.env.DECK_MONSTERS_DELAY_ROUND_FACTOR_STEP,
		0
	);
	if (step === 0 || round <= 1) return delayMs;

	const minFactor = parseFloatWithDefault(
		process.env.DECK_MONSTERS_DELAY_ROUND_MIN_FACTOR,
		0.25
	);
	const maxFactor = parseFloatWithDefault(
		process.env.DECK_MONSTERS_DELAY_ROUND_MAX_FACTOR,
		2
	);
	const lower = Math.min(minFactor, maxFactor);
	const upper = Math.max(minFactor, maxFactor);
	const rawFactor = 1 + step * (round - 1);
	const factor = Math.min(upper, Math.max(lower, rawFactor));
	return Math.max(0, Math.round(delayMs * factor));
};

const delayFor = (kind: DelayKind, round = 1): number => {
	if (skip()) return 0;
	const midpoint = getMidpoint(kind);
	const { min, max } = getRangeFromMidpoint(midpoint);
	const sampled = sampleInRange(min, max);
	const shaped = applyRoundShaping(sampled, round);
	const cap = getCap(kind);
	if (!cap) return shaped;
	return Math.min(shaped, cap);
};

export const veryShortDelay = (round = 1): number =>
	delayFor('very_short', round);

export const shortDelay = (round = 1): number =>
	delayFor('short', round);

export const mediumDelay = (round = 1): number =>
	delayFor('medium', round);

export const longDelay = (round = 1): number =>
	delayFor('long', round);

const DEFAULT_SUB_EVENT_MS = 1000;

export const subEventDelay = (): Promise<void> => {
	if (skip()) return Promise.resolve();
	const midpoint = parsePositiveInt(
		process.env.DECK_MONSTERS_SUB_EVENT_DELAY_MIDPOINT_MS,
		DEFAULT_SUB_EVENT_MS
	);
	const { min, max } = getRangeFromMidpoint(midpoint);
	return new Promise(r => setTimeout(r, sampleInRange(min, max)));
};

const delayTimes = {
	veryShortDelay,
	shortDelay,
	mediumDelay,
	longDelay,
	subEventDelay,
	ONE_MINUTE
};

export default delayTimes;
