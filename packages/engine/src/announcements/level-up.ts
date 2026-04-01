import type { RoomEventBus } from '../events/index.js';

export function announceLevelUp(
	eb: RoomEventBus,
	monster: any,
	level: number
): void {
	eb.publish({
		type: 'announce',
		scope: 'public',
		text: `🎉 ${monster.icon}  **${monster.givenName}** has reached level ${level}! (${monster.displayLevel})`,
		payload: { monster, level },
	});
}
