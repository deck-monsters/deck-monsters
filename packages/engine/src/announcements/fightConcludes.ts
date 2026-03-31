type PublicChannel = (opts: { announce: string }) => void | Promise<void>;

interface ChannelManager {
	sendMessages(): void;
}

interface FightConcludesOpts {
	deaths: number;
	isDraw: boolean;
	rounds: number;
}

export function announceFightConcludes(
	publicChannel: PublicChannel,
	channelManager: ChannelManager,
	className: string,
	ring: any,
	{ deaths, isDraw, rounds }: FightConcludesOpts,
): void {
	publicChannel({
		announce: `The fight concluded ${isDraw ? 'in a draw' : `with ${deaths} dead`} after ${rounds} ${rounds === 1 ? 'round' : 'rounds'}!

≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡
`,
	});

	channelManager.sendMessages();
}
