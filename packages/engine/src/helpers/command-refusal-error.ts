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
