type PublicChannel = (opts: { announce: string }) => void | Promise<void>;
type ChannelManager = Record<string, never>;

interface MissOpts {
	attackResult: number;
	curseOfLoki: boolean;
	player: any;
	target: any;
}

export function announceMiss(
	publicChannel: PublicChannel,
	channelManager: ChannelManager,
	className: string,
	card: any,
	{ attackResult, curseOfLoki, player, target }: MissOpts,
): void {
	let action = 'is blocked by';
	let flavor = '';
	let icon = '🛡';

	if (curseOfLoki) {
		action = 'misses';
		flavor = 'horribly';
		icon = '💨';
	} else if (target.dead) {
		action = 'stops mercilessly beating the dead body of';
		switch (player.gender) {
			case 'female':
				icon = '💃';
				break;
			case 'male':
				icon = '🙇‍';
				break;
			default:
				icon = '⚰️';
		}
	} else if (attackResult > 5) {
		action = 'is barely blocked by';
		icon = '⚔️';
	}

	const targetIdentifier = target === player ? `${target.pronouns.him}self` : target.givenName;

	publicChannel({
		announce: `${player.icon} ${icon} ${target.icon}    ${player.givenName} ${action} ${targetIdentifier} ${flavor}
`,
	});
}
