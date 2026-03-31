type PublicChannel = (opts: { announce: string }) => void | Promise<void>;
type ChannelManager = Record<string, never>;

interface EffectOpts {
	player: any;
	target: any;
	effectResult: string;
	narration?: string;
}

export function announceEffect(
	publicChannel: PublicChannel,
	channelManager: ChannelManager,
	className: string,
	card: any,
	{ player, target, effectResult, narration }: EffectOpts,
): void {
	publicChannel({
		announce: `${target.icon} ${target.givenName} is currently ${effectResult} ${player.icon} ${player.givenName}.${narration ? ` ${narration}` : ''}
`,
	});
}
