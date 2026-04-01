import type { RoomEventBus } from '../events/index.js';

export function announceHeal(
	eb: RoomEventBus,
	ring: any,
	className: string,
	monster: any,
	{ amount }: { amount: number },
): void {
	if (ring.monsterIsInRing(monster)) {
		eb.publish({
			type: 'announce',
			scope: 'public',
			text: `${monster.icon} 💊 ${monster.givenName} healed ${amount} hp and has *${monster.hp} hp*.`,
			payload: { monster, amount },
		});
	}
}
