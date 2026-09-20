import { actionCard } from '../helpers/card.js';
import { toCombatActor } from '../events/combat.js';
import type { CombatPayload } from '../events/types.js';
import type { RoomEventBus } from '../events/index.js';

export function announceCard(
	eb: RoomEventBus,
	className: string,
	card: any,
	{ player }: { player: any },
): void {
	const cardPlayed = actionCard(card);
	const rawCardClass = card?.cardClass;
	const cardClass = Array.isArray(rawCardClass)
		? rawCardClass.join(', ')
		: typeof rawCardClass === 'string'
			? rawCardClass
			: undefined;
	const combat: CombatPayload = {
		kind: 'card',
		actor: toCombatActor(player),
		card: {
			name: typeof card?.name === 'string' ? card.name : '',
			...(cardClass === undefined ? {} : { cardClass }),
		},
	};

	eb.publish({
		type: 'card.played',
		scope: 'public',
		text: `${player.identity} lays down the following card:\n${cardPlayed}`,
		payload: { player, card, combat },
	});
}
