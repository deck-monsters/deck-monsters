type ChannelFn = (opts: { announce: string }) => Promise<unknown>;

export const playerHandbook = (channel: ChannelFn): Promise<unknown> =>
	channel({ announce: 'Player Handbook is not available in this build.' });

export default playerHandbook;
