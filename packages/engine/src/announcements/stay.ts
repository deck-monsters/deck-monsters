type PublicChannel = (opts: { announce: string }) => void | Promise<void>;
type ChannelManager = Record<string, never>;

interface StayOpts {
	fleeRoll?: any;
	player: any;
	activeContestants: any[];
}

export function announceStay(
	publicChannel: PublicChannel,
	channelManager: ChannelManager,
	className: string,
	monster: any,
	{ fleeRoll, player, activeContestants }: StayOpts,
): void {
	if (fleeRoll) {
		const assailants = activeContestants
			.filter(contestant => contestant.monster !== player)
			.map(contestant => contestant.monster.identityWithHp);

		publicChannel({
			announce: `${player.identityWithHp} tries to flee from ${assailants.join(' and ')}, but fails!`,
		});
	} else {
		publicChannel({
			announce: `${player.identityWithHp} bravely stays in the ring.`,
		});
	}
}
