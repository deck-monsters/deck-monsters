import { CommandRefusalError } from './command-refusal-error.js';

type ChannelFn = (message: Record<string, unknown>) => Promise<unknown> | unknown;

/**
 * Announces a message on the channel then rejects with a CommandRefusalError
 * whose message matches the announcement.
 *
 * Prefer this over `Promise.reject(channel({ announce }))`, which rejects with
 * a *Promise* as the reason and logs as `[object Promise]` wherever the
 * rejection surfaces.
 *
 * The CommandRefusalError type lets connectors distinguish expected user-facing
 * refusals (quota exhausted, precondition not met, etc.) from unexpected
 * infrastructure errors — so they can show the exact message rather than a
 * generic "something went wrong" fallback.
 */
export const announceAndThrow = async (
	channel: ChannelFn,
	announce: string,
	extra?: Record<string, unknown>
): Promise<never> => {
	await channel({ announce, ...extra });
	throw new CommandRefusalError(announce);
};

export default announceAndThrow;
