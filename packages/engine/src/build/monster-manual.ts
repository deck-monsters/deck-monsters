type ChannelFn = (opts: { announce: string }) => Promise<unknown>;

export const monsterManual = ({ channel }: { channel: ChannelFn }): Promise<unknown> =>
	channel({ announce: 'Monster Manual is not available in this build.' });

export default monsterManual;
