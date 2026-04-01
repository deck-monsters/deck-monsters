import type { RoomEventBus } from '../events/index.js';

interface StayOpts {
	fleeRoll?: any;
	player: any;
	activeContestants: any[];
}

export function announceStay(
	eb: RoomEventBus,
	className: string,
	monster: any,
	{ fleeRoll, player, activeContestants }: StayOpts,
): void {
	if (fleeRoll) {
		const assailants = activeContestants
			.filter(contestant => contestant.monster !== player)
			.map(contestant => contestant.monster.identityWithHp);

		eb.publish({
			type: 'announce',
			scope: 'public',
			text: `${player.identityWithHp} tries to flee from ${assailants.join(' and ')}, but fails!`,
			payload: {},
		});
	} else {
		eb.publish({
			type: 'announce',
			scope: 'public',
			text: `${player.identityWithHp} bravely stays in the ring.`,
			payload: {},
		});
	}
}
