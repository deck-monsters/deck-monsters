type PublicChannel = (opts: { announce: string }) => void | Promise<void>;
type ChannelManager = Record<string, never>;

interface LeaveOpts {
	activeContestants: any[];
}

export function announceLeave(
	publicChannel: PublicChannel,
	channelManager: ChannelManager,
	className: string,
	monster: any,
	{ activeContestants }: LeaveOpts,
): void {
	const assailants = activeContestants
		.filter(contestant => contestant.monster !== monster)
		.map(contestant => contestant.monster.identityWithHp);

	publicChannel({
		announce: `${monster.identityWithHp} flees from ${assailants.join(' and ')}
`,
	});
}
