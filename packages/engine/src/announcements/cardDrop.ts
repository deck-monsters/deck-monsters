import { actionCard } from '../helpers/card.js';

type PublicChannel = (opts: { announce: string }) => void | Promise<void>;

interface ChannelManager {
	queueMessage(opts: { announce: string; channel: any; channelName: string }): void;
}

interface CardDropOpts {
	contestant: any;
	card: any;
}

export function announceCardDrop(
	publicChannel: PublicChannel,
	channelManager: ChannelManager,
	className: string,
	game: any,
	{ contestant, card }: CardDropOpts,
): void {
	const { channel, channelName } = contestant;

	const cardDropped = actionCard(card, true);

	const announce = `${contestant.monster.identity} finds a card for ${contestant.character.identity} in the dust of the ring:

${cardDropped}`;

	channelManager.queueMessage({
		announce,
		channel,
		channelName,
	});

	publicChannel({ announce });
}
