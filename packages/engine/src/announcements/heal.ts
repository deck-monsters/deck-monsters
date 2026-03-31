type PublicChannel = (opts: { announce: string }) => void | Promise<void>;
type ChannelManager = Record<string, never>;

export function announceHeal(
	publicChannel: PublicChannel,
	channelManager: ChannelManager,
	ring: any,
	className: string,
	monster: any,
	{ amount }: { amount: number },
): void {
	if (ring.monsterIsInRing(monster)) {
		publicChannel({
			announce: `${monster.icon} 💊 ${monster.givenName} healed ${amount} hp and has *${monster.hp} hp*.`,
		});
	}
}
