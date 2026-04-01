import type { RoomEventBus } from '../events/index.js';

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

	const text = `${creature.identity} gained ${xpGained} XP${killedMessage}${coinsMessage}${reasonsMessage}`;

	eb.publish({
		type: 'ring.xp',
		scope: 'private',
		targetUserId: contestant.userId,
		text,
		payload: { contestant, creature, xpGained, killed, coinsGained },
	});
}
