import { monsterCard, monsterCardLine } from '../helpers/card.js';
import flavor from '../helpers/flavor.js';
import { RING_PATRON } from '../constants/lore.js';
import { bossPersonalityFor } from '../helpers/boss-personalities.js';
import type { RoomEventBus } from '../events/index.js';
import type { FeedLine } from '../events/types.js';
import { bossEntrance, playerEntrance } from './ring-flavour.js';

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
	// an owner. A boss is *sent in by* the house, which commands (the line once said "at the behest
	// of"; it now reads "sent by the house").
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
	const arrivalSentence = isBoss
		? `A${adjective} ${monster.creatureType} enters the ring, sent by the house (${RING_PATRON}).`
		: `A${adjective} ${monster.creatureType} answers the call of ${character.icon} ${character.givenName}.`;
	const arrival = `${arrivalSentence}${isBoss && temperament ? ` ${temperament}` : ''}`;
	const entrance = isBoss ? bossEntrance(monster, ring?.contestants ?? []) : playerEntrance(monster);

	// The structured twin of `text`: the temperament is its own line so a renderer can style
	// or explain it without matching prose, and the card is one `card` line with no fence.
	const lines: FeedLine[] = [
		{
			kind: 'arrival',
			text: arrivalSentence,
			name: monster.givenName,
			boss: Boolean(isBoss),
			...(isBoss ? {} : { owner: character.givenName }),
		},
		...(isBoss && temperament ? [{ kind: 'temperament', text: temperament } satisfies FeedLine] : []),
		...(entrance ? [{ kind: 'narration', text: entrance } satisfies FeedLine] : []),
		monsterCardLine(monster),
	];

	eb.publish({
		type: 'ring.add',
		scope: 'public',
		text: `${arrival}\n${entrance ? `${entrance}\n` : ''}${monsterCard(monster)}`,
		// `mechanic` lets the web explain temperaments once (roadmap 39 C4); only set when the
		// line actually says one.
		payload: temperament ? { contestant, mechanic: 'boss-temperament', lines } : { contestant, lines },
	});
}
