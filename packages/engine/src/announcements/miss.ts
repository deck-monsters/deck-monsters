import { toCombatActor } from '../events/combat.js';
import type { CombatPayload, FeedLine } from '../events/types.js';
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
	const blocked = !curseOfLoki && !target.dead;

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

	const text = `${player.icon} ${icon} ${target.icon}    ${player.givenName} ${action} ${targetIdentifier} ${flavor}\n`;
	const lines: FeedLine[] = [
		{
			kind: 'miss',
			// The sentence ends in an empty `flavor` slot (a trailing space) when it is not a
			// curse of Loki; the line is trimmed, the text stays as it was.
			text: text.trim(),
			assailant: player.givenName,
			target: target.givenName,
			blocked,
		},
	];

	eb.publish({
		type: 'announce',
		scope: 'public',
		text,
		payload: {
			lines,
			combat: {
				kind: 'miss',
				actor: toCombatActor(player),
				target: toCombatActor(target),
				blocked,
			} satisfies CombatPayload,
		},
	});
}
