import type { RoomEventBus } from '../events/index.js';
import type { FeedLine } from '../events/types.js';

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

		const failedText = `${player.identityWithHp} tries to flee from ${assailants.join(' and ')}, but fails!`;
		eb.publish({
			type: 'announce',
			scope: 'public',
			text: failedText,
			payload: { lines: [{ kind: 'system', text: failedText, name: player.givenName, fled: false }] satisfies FeedLine[] },
		});
	} else {
		const stayText = `${player.identityWithHp} bravely stays in the ring.`;
		eb.publish({
			type: 'announce',
			scope: 'public',
			text: stayText,
			payload: { lines: [{ kind: 'system', text: stayText, name: player.givenName, fled: false }] satisfies FeedLine[] },
		});
	}
}
