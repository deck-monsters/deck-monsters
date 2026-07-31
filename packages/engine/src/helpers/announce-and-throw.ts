type ChannelFn = (message: Record<string, unknown>) => Promise<unknown> | unknown;

/**
 * Announces a message on the channel, then rejects with a real Error whose
 * message matches the announcement. Prefer this over
 * `Promise.reject(channel({ announce }))`, which rejects with a *Promise* as
 * the reason and logs as `[object Promise]` wherever the rejection surfaces.
 */
export const announceAndThrow = async (
	channel: ChannelFn,
	announce: string,
	extra?: Record<string, unknown>
): Promise<never> => {
	await channel({ announce, ...extra });
	throw new Error(announce);
};

export default announceAndThrow;
