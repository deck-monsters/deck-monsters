import { monsterCard } from '../helpers/card.js';

type PublicChannel = (opts: { announce: string }) => void | Promise<void>;
type ChannelManager = Record<string, never>;

export function announceTurnBegin(
	publicChannel: PublicChannel,
	channelManager: ChannelManager,
	className: string,
	ring: any,
	{ contestant }: { contestant: any },
): void {
	const { monster } = contestant;

	publicChannel({
		announce: `*It's ${contestant.character.givenName}'s turn.*

${contestant.character.identity} plays the following monster:
${monsterCard(monster, contestant.lastMonsterPlayed !== monster)}`,
	});

	contestant.lastMonsterPlayed = monster;
}
