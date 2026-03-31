import { itemCard } from '../helpers/card.js';

type PublicChannel = (opts: { announce: string }) => void | Promise<void>;

interface ChannelManager {
	queueMessage(opts: { announce: string; channel: any; channelName: string }): void;
}

interface ItemUsedOpts {
	channel?: any;
	channelName?: string;
	character: any;
	monster?: any;
}

export function announceItem(
	publicChannel: PublicChannel,
	channelManager: ChannelManager,
	className: string,
	item: any,
	{ channel, channelName, character, monster }: ItemUsedOpts,
): void {
	const itemUsed = itemCard(item, true);
	const targetStr = monster ? monster.givenName : `${character.pronouns.him}self`;
	const announce = `${character.identity} uses the following item on ${targetStr}:
${itemUsed}`;

	if (channel) {
		channelManager.queueMessage({
			announce,
			channel,
			channelName: channelName ?? '',
		});
	}

	if (!channel || (monster && monster.inEncounter)) publicChannel({ announce });
}
