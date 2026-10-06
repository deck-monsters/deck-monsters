import { toCombatActor } from '../events/combat.js';
import type { CombatPayload, FeedLine } from '../events/types.js';
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

	const text = `${monster.identityWithHp} flees from ${assailants.join(' and ')}\n`;

	eb.publish({
		type: 'ring.fled',
		scope: 'public',
		text,
		payload: {
			monster,
			lines: [{ kind: 'flee', text: text.trim(), name: monster.givenName }] satisfies FeedLine[],
			combat: {
				kind: 'flee',
				actor: toCombatActor(monster),
			} satisfies CombatPayload,
		},
	});
}
