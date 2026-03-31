// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;

export const throttle = <F extends AnyFunction>(func: F, wait = 0): F => {
	let lastCallTime: number | undefined;
	let lastArgs: Parameters<F> | undefined;
	let lastContext: unknown;
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	let result: ReturnType<F>;

	const invoke = (time: number): ReturnType<F> => {
		lastCallTime = time;
		result = func.apply(lastContext, lastArgs as Parameters<F>) as ReturnType<F>;
		lastArgs = undefined;
		lastContext = undefined;
		return result;
	};

	const trailingEdge = (): void => {
		timeoutId = undefined;
		if (lastArgs) {
			invoke(Date.now());
		}
	};

	return function throttled(this: unknown, ...args: Parameters<F>): ReturnType<F> {
		const now = Date.now();
		const remaining = lastCallTime === undefined ? 0 : wait - (now - lastCallTime);
		lastArgs = args;
		lastContext = this;

		if (remaining <= 0 || remaining > wait) {
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = undefined;
			}

			return invoke(now);
		}

		if (!timeoutId) {
			timeoutId = setTimeout(trailingEdge, remaining);
		}

		return result;
	} as F;
};

export default throttle;
