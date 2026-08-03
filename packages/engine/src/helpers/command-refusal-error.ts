/**
 * Thrown by announceAndThrow() for expected, user-facing command refusals
 * (quota exhausted, precondition not met, etc.). Connectors should catch this
 * specifically so they can surface the exact message to the user (e.g. on a
 * deferred Discord interaction) without masking it as a generic "something went
 * wrong" error. Unexpected infrastructure errors must NOT use this class.
 */
export class CommandRefusalError extends Error {
	/** Sentinel property — lets connectors check without an instanceof across module boundaries. */
	readonly isCommandRefusal = true as const;

	constructor(message: string) {
		super(message);
		this.name = 'CommandRefusalError';
	}
}

/**
 * Type guard that identifies command refusals without relying on instanceof.
 *
 * Using instanceof can fail when the same module is instantiated more than once
 * (e.g. different dist vs. src resolution paths, bundler splits, or test
 * environments). The `isCommandRefusal` sentinel is a plain property, so it
 * survives any package/runtime boundary.
 *
 * Always prefer this function over bare `instanceof CommandRefusalError` in
 * connector and server code.
 */
export function isCommandRefusal(error: unknown): error is CommandRefusalError {
	return (
		typeof error === 'object' &&
		error !== null &&
		'isCommandRefusal' in error &&
		(error as { isCommandRefusal: unknown }).isCommandRefusal === true
	);
}
