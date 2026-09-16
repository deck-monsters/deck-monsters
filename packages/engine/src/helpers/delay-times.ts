export const ONE_MINUTE = 60000;

type DelayKind = 'very_short' | 'short' | 'medium' | 'long';

// Default pacing values, tuned so a live ring feed can actually be read on a phone.
//
// Raised ~1.7x from the previous set (3000/4500/6000/9000) after watching real
// games: a single card play emits 5–7 narration lines *plus* a ten-line ASCII card
// box, so at 3s card-to-card a card's full resolution filled a phone screen faster
// than it could be read. Each kind keeps its [⅔·mid, 4/3·mid] sampling window.
// - very_short: 3400–6800ms (midpoint 5100) — card to card
// - short:      5100–10200ms (midpoint 7650) — round to round
// - medium:     6800–13600ms (midpoint 10200)
// - long:       10200–20400ms (midpoint 15300)
//
// Every value is overridable per-kind via the DECK_MONSTERS_*_DELAY_MIDPOINT_MS /
// _CAP_MS env vars, so pacing can be dialled live without a deploy.
const DEFAULT_MIDPOINTS: Record<DelayKind, number> = {
	very_short: 5100,
	short: 7650,
	medium: 10200,
	long: 15300,
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

// Sub-event pacing within a single card play (roll → hit → damage → death). Raised
// from 1000ms alongside the between-beat midpoints above: these are the lines that
// actually carry the fight's detail, so they were the ones scrolling past unread.
const DEFAULT_SUB_EVENT_MS = 1700;

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
