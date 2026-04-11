const VERY_SHORT_DELAY = 250;
const SHORT_DELAY = 1000;
const MEDIUM_DELAY = 1600;
const LONG_DELAY = 2200;

export const ONE_MINUTE = 60000;

// When DECK_MONSTERS_SKIP_DELAYS=1 all delay functions return 0.  Set this in
// test environments so fight tests complete in milliseconds instead of seconds.
// Checked at call time (not module load time) so the env var can be set in a
// test-setup file that is evaluated before any spec file runs.
const skip = (): boolean => !!process.env.DECK_MONSTERS_SKIP_DELAYS;

// 150–300 ms — used between player turns in ring combat for natural pacing.
// Same ±50% variance pattern as the other delays.
export const veryShortDelay = (): number =>
	skip() ? 0 : Math.ceil(Math.random() * VERY_SHORT_DELAY) + VERY_SHORT_DELAY;

export const shortDelay = (): number =>
	skip() ? 0 : Math.ceil(Math.random() * SHORT_DELAY) + SHORT_DELAY;

export const mediumDelay = (): number =>
	skip() ? 0 : Math.ceil(Math.random() * MEDIUM_DELAY) + MEDIUM_DELAY;

export const longDelay = (): number =>
	skip() ? 0 : Math.ceil(Math.random() * LONG_DELAY) + LONG_DELAY;

const delayTimes = {
	veryShortDelay,
	shortDelay,
	mediumDelay,
	longDelay,
	ONE_MINUTE
};

export default delayTimes;
