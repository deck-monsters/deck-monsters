import { actionCard } from '../helpers/card.js';

type PublicChannel = (opts: { announce: string }) => void | Promise<void>;
type ChannelManager = Record<string, never>;

export function announceCard(
	publicChannel: PublicChannel,
	channelManager: ChannelManager,
	className: string,
	card: any,
	{ player }: { player: any },
): void {
	const cardPlayed = actionCard(card);

	publicChannel({
		announce: `${player.identity} lays down the following card:
${cardPlayed}`,
	});
}
