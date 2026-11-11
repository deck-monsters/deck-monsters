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
 * nothing, and an empty feed has nothing to divide.
 *
 * With no `kind`, any divider at the tail blocks (the original rule). With a `kind`, only
 * a divider of the *same* kind blocks: "connection lost" after "you joined here" is a real
 * thing to say, and refusing it (the old rule) left the loss unmarked while the later
 * "reconnected" still drew: a lone "reconnected" (baseline C5).
 */
export function shouldAppendMarker(
  events: Pick<GameEvent, 'type' | 'payload'>[],
  kind?: FeedMarkerKind
): boolean {
  const last = events[events.length - 1];
  if (last === undefined) return false;
  if (!isFeedMarker(last)) return true;
  if (kind === undefined) return false;
  return feedMarkerKind(last as GameEvent) !== kind;
}

/**
 * A loss that is over before the reader could have noticed it leaves no marks: shorter than
 * this, with nothing missed, draws neither divider. The "reconnecting…" banner and header
 * still show (they are state, not history). Also how long a loss waits before its
 * "connection lost" divider is drawn live.
 */
export const LOSS_MARKER_DELAY_MS = 1_000;

/** What `closeOutageMarkers` needs to know about one outage. */
export type OutageFacts = {
  /** Id of the feed's last row when the loss began (a divider counts), or null if the feed was empty. */
  anchorId: string | null;
  /** The "connection lost" divider was already drawn live for this outage. */
  lossMarkerDrawn: boolean;
  /** Loss to recovery, in ms. */
  outageMs: number;
  /** Events that arrived after the loss and predate the recovery (replayed catch-up). */
  missed: number;
  lostAt: number;
  reconnectedAt: number;
};

/**
 * Close an outage in the feed: decide which of "connection lost" and "reconnected" to draw.
 *
 * - "reconnected" is drawn only when a "connection lost" is in the feed for this outage
 *   (baseline C5: a quiet room used to show a lone "reconnected").
 * - A recovery inside `LOSS_MARKER_DELAY_MS` that missed nothing draws neither.
 * - Otherwise a loss divider that was not drawn live (the outage was too short for the live
 *   timer but events were missed) goes back where the feed went quiet, after the anchor,
 *   so the replayed events land between the two dividers.
 */
export function closeOutageMarkers(events: GameEvent[], outage: OutageFacts): GameEvent[] {
  let next = events;
  let lossInFeed = outage.lossMarkerDrawn;
  if (!lossInFeed) {
    if (outage.outageMs < LOSS_MARKER_DELAY_MS && outage.missed === 0) return events;
    const at = outage.anchorId === null ? -1 : events.findIndex((e) => e.id === outage.anchorId);
    const anchor = at === -1 ? undefined : events[at];
    const following = at === -1 ? undefined : events[at + 1];
    const alreadyThere =
      (anchor !== undefined && feedMarkerKind(anchor) === 'disconnected')
      || (following !== undefined && feedMarkerKind(following) === 'disconnected');
    if (alreadyThere) {
      lossInFeed = true;
    } else if (at !== -1) {
      next = [...events.slice(0, at + 1), createFeedMarker('disconnected', outage.lostAt), ...events.slice(at + 1)];
      lossInFeed = true;
    }
  }
  if (!lossInFeed) return events;
  const last = next[next.length - 1];
  if (last !== undefined && feedMarkerKind(last) === 'reconnected') return next;
  return [...next, createFeedMarker('reconnected', outage.reconnectedAt)];
}
