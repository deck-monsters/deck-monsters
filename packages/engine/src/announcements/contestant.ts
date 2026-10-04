import { monsterCard } from '../helpers/card.js';
import flavor from '../helpers/flavor.js';
import { RING_PATRON } from '../constants/lore.js';
import { bossPersonalityFor } from '../helpers/boss-personalities.js';
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
	// userId 'boss' (docs/architecture/boss-encounters.md §1), so crediting
	// `character.givenName` here invented a beastmaster who does not exist — and for a
	// timer-spawned boss it told the room a player had sent it in when nobody had
	// (10b-bugs-fixed.md #102). Naming the house keeps the sense that something sent it,
	// without inventing a person.
	//
	// "At the behest of" still read as a player's name in new-player walk 2 (the patron looked
	// like whoever had summoned it), so the line now says outright that the house sent it.
	// A boss's temperament is said aloud so players can plan around it (roadmap 31).
	const temperament = isBoss ? bossPersonalityFor(monster.targetingStrategy)?.temperament(monster.pronouns) : undefined;
	const arrival = isBoss
		? `A${adjective} ${monster.creatureType} enters the ring, sent by the house (${RING_PATRON}).${temperament ? ` ${temperament}` : ''}`
		: `A${adjective} ${monster.creatureType} answers the call of ${character.icon} ${character.givenName}.`;

	eb.publish({
		type: 'ring.add',
		scope: 'public',
		text: `${arrival}\n${monsterCard(monster)}`,
		// `mechanic` lets the web explain temperaments once (roadmap 39 C4); only set when the
		// line actually says one.
		payload: temperament ? { contestant, mechanic: 'boss-temperament' } : { contestant },
	});
}
