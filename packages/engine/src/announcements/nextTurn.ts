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
		text: `\n⚀ ⚁ ⚂ ⚃ ⚄ ⚅ ⚀ ⚁ ⚂ ⚃ ⚄ ⚅ ⚀ ⚁ ⚂ ⚃ ⚄ ⚅ ⚀ ⚁ ⚂\n\nround ${round}, turn ${turn + 1}\n\n${contestants.map(contestant => contestant.monster.identityWithHp).join(' vs ')}\n\n`,
		payload: { round, turn, contestants },
	});
}
