/**
 * Serializes async work by string key (e.g. room id) so only one task runs at a time
 * per key. The next task runs whether the previous succeeded or failed, so one bad
 * command does not block the queue permanently.
 */
export function createKeyedPromiseQueue(): <T>(key: string, fn: () => Promise<T>) => Promise<T> {
	const tails = new Map<string, Promise<unknown>>();

	return <T>(key: string, fn: () => Promise<T>): Promise<T> => {
		const prev = tails.get(key) ?? Promise.resolve();
		const next = prev.then(
			() => fn(),
			() => fn()
		) as Promise<T>;
		tails.set(
			key,
			next.then(
				() => undefined,
				() => undefined
			)
		);
		return next;
	};
}
