import type { RoomEventBus } from '../events/index.js';
import type { FeedLine } from '../events/types.js';

interface WinnerLike {
	monsterName: string;
	team: string | null;
}

interface FightConcludesOpts {
	deaths: number;
	isDraw: boolean;
	rounds: number;
	winners?: WinnerLike[];
	/** Monsters that fled. With no deaths, a flee is a draw. */
	fled?: string[];
	/** Monsters still fighting at the end (neither dead nor fled). */
	survivors?: number;
}

const listNames = (names: string[]): string =>
	names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

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
		return `🏆 ${winners[0]!.monsterName} wins!`;
	}

	// A team victory: every survivor of the winning faction wins together.
	const team = winners[0]!.team;
	const sameTeam = team && winners.every(w => w.team === team);
	const names = winners.map(w => w.monsterName).join(', ');

	return sameTeam ? `🏆 ${team} wins! (${names})` : `🏆 ${names} win!`;
}

export function announceFightConcludes(
	eb: RoomEventBus,
	className: string,
	ring: any,
	{ deaths, isDraw, rounds, winners = [], fled = [], survivors }: FightConcludesOpts,
): void {
	const outcome = isDraw ? 'in a draw' : `with ${deaths} dead`;
	const roundWord = rounds === 1 ? 'round' : 'rounds';

	// A bare "draw" read as a contradiction when one monster had just fled and the other
	// was credited as the last one standing, or when every monster had fallen (bug 261).
	// Say why there is no winner.
	let why = '';
	if (isDraw && fled.length > 0 && deaths === 0) {
		why = `${listNames(fled)} fled, so nobody wins. `;
	} else if (isDraw && survivors === 0) {
		why = 'Nobody is left standing. ';
	}

	const winner = winnerLine(winners);
	const concluded = `${why}The fight concluded ${outcome} after ${rounds} ${roundWord}!`;
	const lines: FeedLine[] = [
		...(winner ? [{ kind: 'win', text: winner, winners: winners.map(w => w.monsterName) } satisfies FeedLine] : []),
		{ kind: 'fight-end', text: concluded, deaths, rounds, isDraw },
	];

	eb.publish({
		type: 'announce',
		scope: 'public',
		text: `${winner ? `${winner}\n` : ''}${concluded}\n\n≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡\n`,
		payload: { deaths, isDraw, rounds, winners, lines },
	});
}
