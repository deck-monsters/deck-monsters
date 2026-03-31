import { monsterCard } from '../helpers/card.js';
import flavor from '../helpers/flavor.js';

type PublicChannel = (opts: { announce: string }) => void | Promise<void>;
type ChannelManager = Record<string, never>;

export function announceContestant(
	publicChannel: PublicChannel,
	channelManager: ChannelManager,
	className: string,
	ring: any,
	{ contestant }: { contestant: any },
): void {
	const { character, monster } = contestant;

	publicChannel({
		announce: `A${flavor.getFlavor('monsterAdjective').text} ${monster.creatureType} has entered the ring at the behest of ${character.icon} ${character.givenName}.
${monsterCard(monster)}`,
	});
}
