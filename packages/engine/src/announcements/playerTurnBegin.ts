import { monsterCard, monsterTurnLine } from '../helpers/card.js';
import type { RoomEventBus } from '../events/index.js';

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
		? monsterTurnLine(monster, contestant.team)
		: `${contestant.character.identity} plays the following monster:\n${monsterCard(monster, true)}`;

	eb.publish({
		type: 'announce',
		scope: 'public',
		text: `*It's ${contestant.character.givenName}'s turn.*\n\n${body}`,
		payload: { contestant },
	});

	contestant.lastMonsterPlayed = monster;
}
