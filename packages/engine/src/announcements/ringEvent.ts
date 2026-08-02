import type { RoomEventBus } from '../events/index.js';
import type { RingEventDefinition } from '../ring/ring-events.js';

/**
 * Announces the ring event rolled for the upcoming fight.
 *
 * Published as a plain public `announce` rather than a bespoke event type: `announce`
 * already renders in the web console and ring feed, already survives a reload (it is not in
 * the event persister's `EPHEMERAL_TYPES`), and already reaches Discord. The structured
 * payload is there for anything that wants to render it richly later.
 */
export function announceRingEvent(
	eb: RoomEventBus,
	className: string,
	ring: any,
	{ ringEvent }: { ringEvent: RingEventDefinition },
): void {
	eb.publish({
		type: 'announce',
		scope: 'public',
		text: ringEvent.banner,
		payload: { ringEvent: { id: ringEvent.id, name: ringEvent.name } },
	});
}
