const THROTTLE_RATE = 5000;

export const getThrottleRate = (): number => THROTTLE_RATE;

export const pause = (ms: number): Promise<void> =>
	new Promise(resolve => setTimeout(resolve, ms));

export const pauseHelpers = { getThrottleRate };
