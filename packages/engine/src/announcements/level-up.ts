import type { RoomEventBus } from '../events/index.js';
import type { FeedLine } from '../events/types.js';

export function announceLevelUp(
	eb: RoomEventBus,
	monster: any,
	level: number
): void {
	const text = `🎉 ${monster.icon}  **${monster.givenName}** has reached level ${level}! (${monster.displayLevel})`;

	eb.publish({
		type: 'announce',
		scope: 'public',
		text,
		payload: {
			monster,
			level,
			lines: [{ kind: 'level-up', text, name: monster.givenName, level }] satisfies FeedLine[],
		},
	});
}
