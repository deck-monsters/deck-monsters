type ChannelFn = (opts: { announce: string }) => Promise<unknown>;

export const dungeonMasterGuide = ({ channel }: { channel: ChannelFn }): Promise<unknown> =>
	channel({ announce: 'Dungeon Master Guide is not available in this build.' });

export default dungeonMasterGuide;
