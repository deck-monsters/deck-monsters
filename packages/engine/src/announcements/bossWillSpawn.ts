import { add, formatRelative } from '../helpers/time.js';

type PublicChannel = (opts: { announce: string }) => void | Promise<void>;
type ChannelManager = { sendMessages(): void };

export function announceBossWillSpawn(
	publicChannel: PublicChannel,
	channelManager: ChannelManager,
	className: string,
	ring: any,
	{ delay }: { delay: number },
): void {
	publicChannel({
		announce: `A boss will enter the ring ${formatRelative(add(Date.now(), delay))}`,
	});

	channelManager.sendMessages();
}
