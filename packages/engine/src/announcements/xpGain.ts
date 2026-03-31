type PublicChannel = (opts: { announce: string }) => void | Promise<void>;

interface ChannelManager {
	queueMessage(opts: { announce: string; channel: any; channelName: string }): void;
}

interface XpGainOpts {
	contestant: any;
	creature: any;
	xpGained: number;
	killed?: any[];
	coinsGained?: number;
	reasons?: string;
}

export function announceXPGain(
	publicChannel: PublicChannel,
	channelManager: ChannelManager,
	className: string,
	game: any,
	{ contestant, creature, xpGained, killed, coinsGained, reasons }: XpGainOpts,
): void {
	const { channel, channelName } = contestant;

	let coinsMessage = '';
	if (coinsGained) {
		coinsMessage = ` and ${coinsGained} coins`;
	}

	let killedMessage = '';
	if (killed && killed.length > 0) {
		killedMessage = ` for killing ${killed.length} ${killed.length > 1 ? 'monsters' : 'monster'}.`;
	}

	const reasonsMessage = reasons
		? `

${reasons}`
		: '';

	channelManager.queueMessage({
		announce: `${creature.identity} gained ${xpGained} XP${killedMessage}${coinsMessage}${reasonsMessage}`,
		channel,
		channelName,
	});
}
