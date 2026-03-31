type PublicChannel = (opts: { announce: string }) => void | Promise<void>;
type ChannelManager = Record<string, never>;

interface NextTurnOpts {
	contestants: any[];
	round: number;
	turn: number;
}

export function announceNextTurn(
	publicChannel: PublicChannel,
	channelManager: ChannelManager,
	className: string,
	ring: any,
	{ contestants, round, turn }: NextTurnOpts,
): void {
	publicChannel({
		announce: `
⚀ ⚁ ⚂ ⚃ ⚄ ⚅ ⚀ ⚁ ⚂ ⚃ ⚄ ⚅ ⚀ ⚁ ⚂ ⚃ ⚄ ⚅ ⚀ ⚁ ⚂ ⚃ ⚄ ⚅

round ${round}, turn ${turn + 1}

${contestants.map(contestant => contestant.monster.identityWithHp).join(' vs ')}

`,
	});
}
