import type { RoomEventBus } from '../events/index.js';
import { proseLines } from '../events/feed-lines.js';

interface NarrationOpts {
	channel?: (opts: { announce: string }) => void | Promise<void>;
	channelName?: string;
	narration: string;
	/**
	 * Names a first-time-mechanic line (roadmap 39 C4) so the web can explain the rule once
	 * without matching prose. Carried in `payload.mechanic`; connectors that do not know it
	 * ignore it.
	 */
	mechanic?: string;
}

export function announceNarration(
	eb: RoomEventBus,
	className: string,
	item: any,
	{ channel, narration, mechanic }: NarrationOpts,
): void {
	if (channel) {
		// Items still use the direct callback pattern; call it directly
		void channel({ announce: narration });
	} else {
		eb.publish({ type: 'announce', scope: 'public', text: narration, payload: { ...(mechanic ? { mechanic } : {}), lines: proseLines(narration) } });
	}
}
