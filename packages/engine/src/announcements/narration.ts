type PublicChannel = (opts: { announce: string }) => void | Promise<void>;

interface ChannelManager {
	queueMessage(opts: { announce: string; channel: any; channelName: string }): void;
}

interface NarrationOpts {
	channel?: any;
	channelName?: string;
	narration: string;
}

export function announceNarration(
	publicChannel: PublicChannel,
	channelManager: ChannelManager,
	className: string,
	item: any,
	{ channel, channelName, narration }: NarrationOpts,
): void {
	if (channel) {
		channelManager.queueMessage({
			announce: narration,
			channel,
			channelName: channelName ?? '',
		});
	} else {
		publicChannel({ announce: narration });
	}
}
