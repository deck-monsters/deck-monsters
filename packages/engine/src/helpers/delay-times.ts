const VERY_SHORT_DELAY = 150;
const SHORT_DELAY = 1000;
const MEDIUM_DELAY = 1600;
const LONG_DELAY = 2200;

export const ONE_MINUTE = 60000;

// 150–300 ms — used between player turns in ring combat for natural pacing.
// Same ±50% variance pattern as the other delays.
export const veryShortDelay = (): number =>
	Math.ceil(Math.random() * VERY_SHORT_DELAY) + VERY_SHORT_DELAY;

export const shortDelay = (): number =>
	Math.ceil(Math.random() * SHORT_DELAY) + SHORT_DELAY;

export const mediumDelay = (): number =>
	Math.ceil(Math.random() * MEDIUM_DELAY) + MEDIUM_DELAY;

export const longDelay = (): number =>
	Math.ceil(Math.random() * LONG_DELAY) + LONG_DELAY;

const delayTimes = {
	veryShortDelay,
	shortDelay,
	mediumDelay,
	longDelay,
	ONE_MINUTE
};

export default delayTimes;
