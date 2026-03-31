type PublicChannel = (opts: { announce: string }) => void | Promise<void>;
type ChannelManager = Record<string, never>;

export function announceEndOfDeck(
	publicChannel: PublicChannel,
	channelManager: ChannelManager,
	className: string,
	ring: any,
	{ contestant }: { contestant: any },
): void {
	const { monster } = contestant;

	publicChannel({
		announce: `${monster.identity} is out of cards.`,
	});
}
