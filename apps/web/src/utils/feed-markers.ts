import type { GameEvent } from '@deck-monsters/server/types';

/**
 * Client-side dividers drawn into the ring feed to mark breaks the reader lived through:
 * where the page was loaded, and where the connection dropped and came back.
 *
 * A time-gap rule was considered and rejected. The boss spawn window is 20–35 minutes
 * and an empty ring is silent by design, so "a long pause" is the feed's normal resting
 * state — a gap rule would shred a quiet evening into dividers and come to mean "nothing
 * happened". These markers instead come from signals the client already has exactly:
 * the history/live boundary, the subscription's error, and its handshake.
 *
 * They are per-viewer and never persisted: "you lost connection" is not a fact about the
 * room, so it must not enter `room_events` or reach Discord. Modelling them as synthetic
 * GameEvents lets them flow through the feed's existing dedupe and virtualization
 * unchanged; nothing ever feeds them back to the server, because they are only ever added
 * by the pane, never by the subscription.
 */
export const FEED_MARKER_TYPE = 'client.marker';

export type FeedMarkerKind = 'joined' | 'disconnected' | 'reconnected';

const MARKER_LABELS: Record<FeedMarkerKind, string> = {
  joined: 'you joined here',
  disconnected: 'connection lost',
  reconnected: 'reconnected',
};

let markerSequence = 0;

/** Builds a divider. Ids are locally unique and never sent back to the server. */
export function createFeedMarker(kind: FeedMarkerKind, timestamp = Date.now()): GameEvent {
  markerSequence += 1;
  return {
    id: `marker-${kind}-${timestamp}-${markerSequence}`,
    roomId: '',
    timestamp,
    type: FEED_MARKER_TYPE as GameEvent['type'],
    scope: 'public',
    text: MARKER_LABELS[kind],
    payload: { markerKind: kind },
  } as GameEvent;
}

export function isFeedMarker(event: Pick<GameEvent, 'type'>): boolean {
  // `type` is a server-side union; this marker is client-only and deliberately outside it.
  return (event.type as string) === FEED_MARKER_TYPE;
}

export function feedMarkerKind(event: GameEvent): FeedMarkerKind | null {
  if (!isFeedMarker(event)) return null;
  const kind = (event.payload as { markerKind?: FeedMarkerKind } | undefined)?.markerKind;
  return kind ?? null;
}

/**
 * Whether a marker would be redundant at the tail of the feed. Two dividers in a row say
 * nothing — a drop with no events in between, or a reconnect that recovered nothing.
 */
export function shouldAppendMarker(events: Pick<GameEvent, 'type'>[]): boolean {
  const last = events[events.length - 1];
  return last === undefined ? false : !isFeedMarker(last);
}
