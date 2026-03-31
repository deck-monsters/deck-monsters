type PublicChannel = (opts: { announce: string }) => void | Promise<void>;
type ChannelManager = Record<string, never>;

interface DeathOpts {
	assailant: any;
	destroyed: boolean;
}

export function announceDeath(
	publicChannel: PublicChannel,
	channelManager: ChannelManager,
	className: string,
	monster: any,
	{ assailant, destroyed }: DeathOpts,
): void {
	let announce: string;

	if (destroyed) {
		announce = `In accordance with XinWey's Doctrine: A person needs to experience real danger or they will never find joy in excelling. There has to be a risk of failure, the chance to die.
As such, ${monster.identityWithHp} has been sent to the land of ${monster.pronouns.his} ancestors by ${assailant.identityWithHp}
So it is written. So it is done.
☠️  R.I.P ${monster.identity}
`;
	} else {
		announce = `💀  ${monster.identityWithHp} is killed by ${assailant.identityWithHp}
`;
	}

	publicChannel({ announce });
}
