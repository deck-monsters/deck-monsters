/**
 * Per-monster card counters for `sim:monster`. The counters come from wrapping card
 * classes' prototype methods for the length of the process only; nothing in the engine is
 * instrumented for them.
 */
export interface MonsterReport {
	/**
	 * A thematic deck to run beside random legal decks. It is a design demonstration, not a
	 * starting deck: it is assigned directly, so it skips the level gate even at level 1.
	 */
	fixtureDeck?: string[];
	/** Wrap card methods once per process. `isSubject` is true for the monster under test. */
	instrument(isSubject: (creature: unknown) => boolean): void;
	/** Zero the counters before a run. */
	reset(): void;
	/** The counters since the last reset. */
	snapshot(): Record<string, number>;
	/** One indented block of text describing a set of counters (a run's, or summed totals). */
	describe(counts: Record<string, number>): string;
}

export type Method = (this: unknown, ...args: unknown[]) => unknown;
export type Proto = Record<string, Method>;

export const wrap = (
	target: Proto,
	method: string,
	around: (original: Method, self: unknown, args: unknown[]) => unknown,
): void => {
	const original = target[method]!;
	target[method] = function wrapped(this: unknown, ...args: unknown[]) {
		return around(original, this, args);
	};
};

export const pct = (n: number, d: number): string => (d > 0 ? `${((100 * n) / d).toFixed(1)}%` : '—');
