import type { RoomEventBus } from '../events/index.js';

export function announceNextRound(
	eb: RoomEventBus,
	className: string,
	ring: any,
	{ round }: { round: number },
): void {
	eb.publish({
		type: 'announce',
		scope: 'public',
		text: `\n⚀ ⚁ ⚂ ⚃ ⚄ ⚅ ⚀ ⚁ ⚂ ⚃ ⚄ ⚅ ⚀ ⚁ ⚂ ⚃ ⚄ ⚅ ⚀ ⚁ ⚂ ⚃\n\n🏁       round ${round + 1}\n`,
		payload: { round },
	});
}
