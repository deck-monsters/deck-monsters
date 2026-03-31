type PublicChannel = (opts: { announce: string }) => void | Promise<void>;
type ChannelManager = Record<string, never>;

export function announceFight(
	publicChannel: PublicChannel,
	channelManager: ChannelManager,
	className: string,
	ring: any,
	{ contestants }: { contestants: any[] },
): void {
	publicChannel({
		announce: `
_______________________________________________________________________________________________________
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
${contestants.length} contestants stand tall under the laudations and hissing jeers of a roaring crowd.

⚔︎ Let the games begin! ⚔︎
`,
	});
}
