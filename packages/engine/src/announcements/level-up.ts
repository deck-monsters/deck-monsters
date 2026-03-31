type ChannelFn = (opts: { announce: string }) => Promise<void>;

export function announceLevelUp(
	publicChannel: ChannelFn,
	monster: any,
	level: number
): Promise<void> {
	return publicChannel({
		announce: `🎉 ${monster.icon}  **${monster.givenName}** has reached level ${level}! (${monster.displayLevel})`,
	});
}
