import { itemCard } from '../helpers/card.js';
import type { RoomEventBus } from '../events/index.js';

interface ItemUsedOpts {
	channel?: (opts: { announce: string }) => void | Promise<void>;
	channelName?: string;
	character: any;
	monster?: any;
}

export function announceItem(
	eb: RoomEventBus,
	className: string,
	item: any,
	{ channel, character, monster }: ItemUsedOpts,
): void {
	const itemUsed = itemCard(item, true);
	const targetStr = monster ? monster.givenName : `${character.pronouns.him}self`;
	const announce = `${character.identity} uses the following item on ${targetStr}:\n${itemUsed}`;

	if (channel) {
		// Items still use the direct callback pattern; call it directly
		void channel({ announce });
	}

	if (!channel || (monster && monster.inEncounter)) {
		eb.publish({ type: 'announce', scope: 'public', text: announce, payload: { item, character, monster } });
	}
}
