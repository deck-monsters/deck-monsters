import type { RoomEventBus } from '../events/index.js';

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
		payload: { round, turn, contestants },
	});
}
