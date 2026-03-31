type PublicChannel = (opts: { announce: string }) => void | Promise<void>;
type ChannelManager = Record<string, never>;

export function announceContestantLeave(
	publicChannel: PublicChannel,
	channelManager: ChannelManager,
	className: string,
	ring: any,
	{ contestant }: { contestant: any },
): void {
	const { character, monster } = contestant;

	publicChannel({
		announce: `${monster.givenName} was summoned from the ring by ${character.identity}.`,
	});
}
