/**
 * A virtual clock for `record-feed-fixture.ts`.
 *
 * The engine paces narration with real `setTimeout` waits and reads `Date.now()` to size the
 * gap after each message (`helpers/pacing-context.ts`, `remainingGapMs`). Running with
 * `DECK_MONSTERS_SKIP_DELAYS` zeroes those waits, so the real gaps would have to be
 * reconstructed after the fact, and they depend on the sampled delay, the size of the message
 * just shown and the time already elapsed. Instead this clock replaces `Date`, `setTimeout`,
 * `setInterval` and their `clear*` twins, and the driver jumps straight to the next due timer
 * once the engine has gone quiet. The engine therefore runs its production pacing code
 * unchanged, in milliseconds of wall time, and every event carries the time it would have had.
 */

type Callback = (...args: unknown[]) => void;

interface VirtualTimer {
	id: number;
	at: number;
	seq: number;
	fn: Callback;
	args: unknown[];
	/** Repeat period for `setInterval`. */
	every?: number;
	cleared: boolean;
}

export interface VirtualClock {
	now(): number;
	/** Number of timers still waiting. */
	pending(): number;
	/** Lets the engine's promise chains run without advancing time. */
	settle(): Promise<void>;
	/** Advance by `ms`, firing every timer that falls inside the window, in order. */
	advance(ms: number): Promise<void>;
	/** Fires timers in order until `done()` is true. Throws past `maxMs` virtual ms. */
	runUntil(done: () => boolean, maxMs: number): Promise<void>;
}

/** Real `setImmediate`, kept before anything is patched. */
const realSetImmediate = globalThis.setImmediate;

export function installVirtualClock(startMs: number): VirtualClock {
	let now = startMs;
	let seq = 0;
	let nextId = 1;
	const timers = new Map<number, VirtualTimer>();
	const RealDate = Date;

	// `new Date()` with no argument reads the real clock, not `Date.now`, so subclass it.
	class VirtualDate extends RealDate {
		constructor(...args: unknown[]) {
			if (args.length === 0) super(now);
			else super(...(args as [number]));
		}

		static override now(): number {
			return now;
		}
	}
	globalThis.Date = VirtualDate as unknown as DateConstructor;

	const handleFor = (timer: VirtualTimer) => {
		const handle = {
			ref: () => handle,
			unref: () => handle,
			hasRef: () => true,
			refresh: () => handle,
			close: () => {
				timer.cleared = true;
				timers.delete(timer.id);
				return handle;
			},
			[Symbol.toPrimitive]: () => timer.id,
			_virtualTimerId: timer.id,
		};
		return handle;
	};

	const schedule = (fn: Callback, ms: unknown, args: unknown[], repeat: boolean) => {
		const delay = Math.max(0, Number.isFinite(Number(ms)) ? Number(ms) : 0);
		const timer: VirtualTimer = {
			id: nextId++,
			at: now + delay,
			seq: seq++,
			fn,
			args,
			cleared: false,
			...(repeat ? { every: Math.max(1, delay) } : {}),
		};
		timers.set(timer.id, timer);
		return handleFor(timer);
	};

	const clear = (handle: unknown) => {
		if (handle === undefined || handle === null) return;
		const id =
			typeof handle === 'object'
				? (handle as { _virtualTimerId?: number })._virtualTimerId
				: Number(handle);
		if (id === undefined) return;
		const timer = timers.get(id);
		if (timer) {
			timer.cleared = true;
			timers.delete(id);
		}
	};

	globalThis.setTimeout = ((fn: Callback, ms?: number, ...args: unknown[]) =>
		schedule(fn, ms, args, false)) as unknown as typeof setTimeout;
	globalThis.setInterval = ((fn: Callback, ms?: number, ...args: unknown[]) =>
		schedule(fn, ms, args, true)) as unknown as typeof setInterval;
	globalThis.clearTimeout = clear as typeof clearTimeout;
	globalThis.clearInterval = clear as typeof clearInterval;

	const settle = async (): Promise<void> => {
		// A few turns of the real event loop drain every microtask chain the engine has queued.
		for (let i = 0; i < 4; i += 1) await new Promise<void>(resolve => realSetImmediate(resolve));
	};

	const nextTimer = (): VirtualTimer | undefined => {
		let best: VirtualTimer | undefined;
		for (const timer of timers.values()) {
			if (!best || timer.at < best.at || (timer.at === best.at && timer.seq < best.seq)) best = timer;
		}
		return best;
	};

	const fire = (timer: VirtualTimer): void => {
		now = Math.max(now, timer.at);
		if (timer.every !== undefined) {
			timer.at = now + timer.every;
			timer.seq = seq++;
		} else {
			timers.delete(timer.id);
		}
		timer.fn(...timer.args);
	};

	return {
		now: () => now,
		pending: () => timers.size,
		settle,
		async advance(ms: number) {
			const until = now + ms;
			await settle();
			for (;;) {
				const timer = nextTimer();
				if (!timer || timer.at > until) break;
				fire(timer);
				await settle();
			}
			now = Math.max(now, until);
		},
		async runUntil(done: () => boolean, maxMs: number) {
			const limit = now + maxMs;
			await settle();
			while (!done()) {
				const timer = nextTimer();
				if (!timer) throw new Error('virtual clock: nothing left to run and the condition is not met');
				if (timer.at > limit) throw new Error(`virtual clock: condition not met within ${maxMs} virtual ms`);
				fire(timer);
				await settle();
			}
		},
	};
}
