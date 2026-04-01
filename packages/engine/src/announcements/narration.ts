import type { RoomEventBus } from '../events/index.js';

interface NarrationOpts {
	channel?: (opts: { announce: string }) => void | Promise<void>;
	channelName?: string;
	narration: string;
}

export function announceNarration(
	eb: RoomEventBus,
	className: string,
	item: any,
	{ channel, narration }: NarrationOpts,
): void {
	if (channel) {
		// Items still use the direct callback pattern; call it directly
		void channel({ announce: narration });
	} else {
		eb.publish({ type: 'announce', scope: 'public', text: narration, payload: {} });
	}
}
