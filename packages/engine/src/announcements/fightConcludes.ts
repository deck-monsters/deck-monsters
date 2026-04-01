import type { RoomEventBus } from '../events/index.js';

interface FightConcludesOpts {
	deaths: number;
	isDraw: boolean;
	rounds: number;
}

export function announceFightConcludes(
	eb: RoomEventBus,
	className: string,
	ring: any,
	{ deaths, isDraw, rounds }: FightConcludesOpts,
): void {
	eb.publish({
		type: 'announce',
		scope: 'public',
		text: `The fight concluded ${isDraw ? 'in a draw' : `with ${deaths} dead`} after ${rounds} ${rounds === 1 ? 'round' : 'rounds'}!\n\n≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡\n`,
		payload: { deaths, isDraw, rounds },
	});
}
