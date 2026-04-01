import type { RoomEventBus } from '../events/index.js';

interface MissOpts {
	attackResult: number;
	curseOfLoki: boolean;
	player: any;
	target: any;
}

export function announceMiss(
	eb: RoomEventBus,
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

	eb.publish({
		type: 'announce',
		scope: 'public',
		text: `${player.icon} ${icon} ${target.icon}    ${player.givenName} ${action} ${targetIdentifier} ${flavor}\n`,
		payload: {},
	});
}
