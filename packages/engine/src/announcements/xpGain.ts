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
		coinsMessage = ` and ${coinsGained} coins`;
	}

	let killedMessage = '';
	if (killed && killed.length > 0) {
		killedMessage = ` for killing ${killed.length} ${killed.length > 1 ? 'monsters' : 'monster'}.`;
	}

	const reasonsMessage = reasons
		? `\n\n${reasons}`
		: '';

	const headline = `${creature.identity} gained ${xpGained} XP${killedMessage}${coinsMessage}`;
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
