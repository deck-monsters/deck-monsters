import { monsterCard, monsterTurnLine } from '../helpers/card.js';
import { isRivalTeam } from '../ring/ring-events.js';
import type { RoomEventBus } from '../events/index.js';

import { possessive } from '../helpers/possessive.js';

// Kept exported from here for existing importers; it lives in helpers so `monsters/base.ts`
// can use it without importing an announcement.
export { possessive };

/**
 * Announces whose turn it is.
 *
 * The full monster card is printed only the first time a monster acts in a fight.
 * Re-printing it every turn made the stat block the bulk of the feed — see
 * `monsterTurnLine` for the measurements — and the card box for the card being played
 * lands immediately after it, so the two together dominated the screen.
 */
export function announceTurnBegin(
	eb: RoomEventBus,
	className: string,
	ring: any,
	{ contestant }: { contestant: any },
): void {
	const { monster } = contestant;
	const alreadySeen = contestant.lastMonsterPlayed === monster;

	const body = alreadySeen
		? monsterTurnLine(monster, isRivalTeam(contestant.team) ? undefined : contestant.team)
		: `${contestant.character.identity} plays the following monster:\n${monsterCard(monster, true)}`;

	// A boss's character is the shared "The Editor", which names nobody in the roster or the
	// feed; the monster's own given name is what a player can match to the roster row.
	const turnName = contestant.isBoss ? monster.givenName : contestant.character.givenName;

	eb.publish({
		type: 'announce',
		scope: 'public',
		text: `*It's ${possessive(turnName)} turn. ${monster.givenName} plays the next card in ${monster.pronouns?.his ?? 'their'} deck.*\n\n${body}`,
		payload: { contestant },
	});

	contestant.lastMonsterPlayed = monster;
}
