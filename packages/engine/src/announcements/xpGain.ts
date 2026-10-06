import type { RoomEventBus } from '../events/index.js';
import type { FeedLine } from '../events/types.js';
import { proseLines } from '../events/feed-lines.js';

interface XpGainOpts {
	contestant: any;
	creature: any;
	xpGained: number;
	killed?: any[];
	coinsGained?: number;
	reasons?: string;
}

export function announceXPGain(
	eb: RoomEventBus,
	className: string,
	game: any,
	{ contestant, creature, xpGained, killed, coinsGained, reasons }: XpGainOpts,
): void {
	let coinsMessage = '';
	if (coinsGained) {
		coinsMessage = ` and ${coinsGained} ${coinsGained === 1 ? 'coin' : 'coins'}`;
	}

	let killedMessage = '';
	if (killed && killed.length > 0) {
		killedMessage = ` for killing ${killed.length} ${killed.length > 1 ? 'monsters' : 'monster'}`;
	}

	const reasonsMessage = reasons
		? `\n\n${reasons}`
		: '';

	// Coins before the kill clause, and one full stop at the end: the kill clause used to end
	// with its own stop, so a win with coins read "for killing 1 monster. and 3 coins" (found by
	// the exact-text test, 2026-10-06). Without a kill the line is unchanged.
	const headline = `${creature.identity} gained ${xpGained} XP${coinsMessage}${killedMessage}${killedMessage ? '.' : ''}`;
	const text = `${headline}${reasonsMessage}`;
	const lines: FeedLine[] = [
		{
			kind: 'xp',
			text: headline,
			name: creature.givenName,
			xp: xpGained,
			...(coinsGained ? { coins: coinsGained } : {}),
			...(killed && killed.length > 0 ? { killed: killed.length } : {}),
		},
		...proseLines(reasons),
	];

	eb.publish({
		type: 'ring.xp',
		scope: 'private',
		targetUserId: contestant.userId,
		text,
		payload: { contestant, creature, xpGained, killed, coinsGained, lines },
	});
}
