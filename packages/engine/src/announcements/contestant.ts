import { monsterCard } from '../helpers/card.js';
import flavor from '../helpers/flavor.js';
import { RING_PATRON } from '../constants/lore.js';
import type { RoomEventBus } from '../events/index.js';

export function announceContestant(
	eb: RoomEventBus,
	className: string,
	ring: any,
	{ contestant }: { contestant: any },
): void {
	const { character, monster, isBoss } = contestant;
	const adjective = flavor.getFlavor('monsterAdjective').text;

	// A deliberate minimal pair: same sentence shape, opposite consent. A player's monster
	// *answers a call* — it came willingly, and its beastmaster is a companion rather than
	// an owner. A boss is *sent in at the behest of* the house, which commands.
	//
	// Bosses are handed a randomly generated owner by `randomCharacter` under
	// userId 'boss' (docs/boss-encounters.md §1), so crediting `character.givenName` here
	// invented a beastmaster who does not exist — and for a timer-spawned boss it told the
	// room a player had sent it in when nobody had (10b-bugs-fixed.md #102). Naming the
	// house keeps the sense that something sent it, without inventing a person.
	const arrival = isBoss
		? `A${adjective} ${monster.creatureType} enters the ring at the behest of ${RING_PATRON}.`
		: `A${adjective} ${monster.creatureType} answers the call of ${character.icon} ${character.givenName}.`;

	eb.publish({
		type: 'ring.add',
		scope: 'public',
		text: `${arrival}\n${monsterCard(monster)}`,
		payload: { contestant },
	});
}
