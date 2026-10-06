import type { RoomEventBus } from '../events/index.js';
import type { FeedLine } from '../events/types.js';
import { standingLine } from '../events/feed-lines.js';

interface NextTurnOpts {
	contestants: any[];
	round: number;
	turn: number;
}

export function announceNextTurn(
	eb: RoomEventBus,
	className: string,
	ring: any,
	{ contestants, round, turn }: NextTurnOpts,
): void {
	// `round` is already 1-based here: the ring starts its counter at 1 and passes it
	// through unchanged, and `announceNextRound` prints `round + 1` for the round that is
	// about to begin. (The turn is 0-based: it is the card index, so it prints `turn + 1`.)
	// The `lines` are one `turn` banner plus one `standing` line per contestant; the
	// text's " vs " separator is layout between them, not a line of its own.
	const lines: FeedLine[] = [
		{ kind: 'turn', text: `🎲  round ${round}, turn ${turn + 1}`, round, turn: turn + 1 },
		...contestants.map(contestant => standingLine(contestant.monster)),
	];

	eb.publish({
		type: 'announce',
		scope: 'public',
		// This used to open with 21 dice — U+2680–U+2685, which JetBrains Mono does not
		// ship, so every one rendered as a tofu box and the row wrapped to two lines on a
		// phone, on every turn (10b-bugs-fixed.md #101). 🎲 is an emoji rather than a
		// symbol-block codepoint, so it renders from the system emoji font: the dice motif
		// survives at one glyph instead of twenty-one. Turns are frequent, so this is the
		// lighter of the two banners.
		text: `\n🎲  round ${round}, turn ${turn + 1}\n\n${contestants.map(contestant => contestant.monster.identityWithHp).join(' vs ')}\n\n`,
		payload: { round, turn, contestants, lines },
	});
}
