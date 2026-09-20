import { toCombatActor } from '../events/combat.js';
import type { CombatPayload } from '../events/types.js';
import type { RoomEventBus } from '../events/index.js';

interface LeaveOpts {
	activeContestants: any[];
}

export function announceLeave(
	eb: RoomEventBus,
	className: string,
	monster: any,
	{ activeContestants }: LeaveOpts,
): void {
	const assailants = activeContestants
		.filter(contestant => contestant.monster !== monster)
		.map(contestant => contestant.monster.identityWithHp);

	eb.publish({
		type: 'ring.fled',
		scope: 'public',
		text: `${monster.identityWithHp} flees from ${assailants.join(' and ')}\n`,
		payload: {
			monster,
			combat: {
				kind: 'flee',
				actor: toCombatActor(monster),
			} satisfies CombatPayload,
		},
	});
}
