import { monsterCard } from '../helpers/card.js';
import flavor from '../helpers/flavor.js';
import type { RoomEventBus } from '../events/index.js';

export function announceContestant(
	eb: RoomEventBus,
	className: string,
	ring: any,
	{ contestant }: { contestant: any },
): void {
	const { character, monster, isBoss } = contestant;
	const adjective = flavor.getFlavor('monsterAdjective').text;

	// Bosses are handed a randomly generated owner by `randomCharacter` under
	// userId 'boss' (docs/boss-encounters.md §1), so the usual "at the behest of X"
	// clause invented a plausible-looking beastmaster and credited the boss to them.
	// Worst for a timer-spawned boss, where no player was involved at all and the feed
	// still named someone. A boss arrives on its own; who summoned a *player*-summoned
	// boss is said by the summon line that now precedes this one (commands/monster.ts).
	const arrival = isBoss
		? `A${adjective} ${monster.creatureType} has entered the ring.`
		: `A${adjective} ${monster.creatureType} has entered the ring at the behest of ${character.icon} ${character.givenName}.`;

	eb.publish({
		type: 'ring.add',
		scope: 'public',
		text: `${arrival}\n${monsterCard(monster)}`,
		payload: { contestant },
	});
}
