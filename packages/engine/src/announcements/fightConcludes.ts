import type { RoomEventBus } from '../events/index.js';

interface WinnerLike {
	monsterName: string;
	team: string | null;
}

interface FightConcludesOpts {
	deaths: number;
	isDraw: boolean;
	rounds: number;
	winners?: WinnerLike[];
}

/**
 * Names the winner in the concluding banner.
 *
 * The ring has always known who won — `contestants.filter(c => c.won)` drives the
 * fight log, the leaderboard and XP — but the public announcement only ever reported
 * the body count ("The fight concluded with 4 dead after 2 rounds!"). In a 5-way
 * fight that leaves the single most interesting fact off the feed: players had to
 * scroll back through the kill lines and work out by elimination who was still
 * standing.
 *
 * Team wins (the `last-team` victory mode used by Common Cause and House War) can
 * have several winners, so this handles one, many, and none.
 */
function winnerLine(winners: WinnerLike[]): string {
	if (winners.length < 1) return '';

	if (winners.length === 1) {
		return `🏆 ${winners[0]!.monsterName} wins!\n`;
	}

	// A team victory: every survivor of the winning faction wins together.
	const team = winners[0]!.team;
	const sameTeam = team && winners.every(w => w.team === team);
	const names = winners.map(w => w.monsterName).join(', ');

	return sameTeam ? `🏆 ${team} wins! (${names})\n` : `🏆 ${names} win!\n`;
}

export function announceFightConcludes(
	eb: RoomEventBus,
	className: string,
	ring: any,
	{ deaths, isDraw, rounds, winners = [] }: FightConcludesOpts,
): void {
	const outcome = isDraw ? 'in a draw' : `with ${deaths} dead`;
	const roundWord = rounds === 1 ? 'round' : 'rounds';

	eb.publish({
		type: 'announce',
		scope: 'public',
		text: `${winnerLine(winners)}The fight concluded ${outcome} after ${rounds} ${roundWord}!\n\n≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡\n`,
		payload: { deaths, isDraw, rounds, winners },
	});
}
