import { useEffect, useRef } from 'react';
import { trpc } from '../lib/trpc.js';

/**
 * Whether a fight is on the ring right now, for panels that report on fights after they
 * end (the Fights and Leaders panels; roadmap 39 B2).
 *
 * Reads the same room-scoped, membership-checked `game.ringState` query RingPane uses, so
 * the two share one cache entry per room. The polling is what lets an empty panel change
 * its line when a fight starts or ends without the Ring pane being mounted (a phone on the
 * Fights tab): 5 s while a fight is on, 15 s otherwise. A quiet-ring interval of 60 s left
 * "No fights yet" on screen for up to a minute after a fight began, which is the very
 * complaint this fixes.
 *
 * `onEnded` runs once when a fight goes from on to off. Callers refetch their own data
 * there: their refetch interval stops the moment the fight does, so without it the last
 * fetch predates the fight's summary and the panel would keep saying nothing happened.
 */
export const FIGHT_ON_RING_POLL_MS = 5_000;
export const QUIET_RING_POLL_MS = 15_000;

export function useFightOnRing(roomId: string | undefined, onEnded?: () => void): boolean {
  const ringState = trpc.game.ringState.useQuery(
    { roomId: roomId ?? '' },
    {
      enabled: !!roomId,
      refetchInterval: (query: { state: { data?: { inEncounter?: boolean } } }) =>
        query.state.data?.inEncounter ? FIGHT_ON_RING_POLL_MS : QUIET_RING_POLL_MS,
    },
  );
  const on = ringState.data?.inEncounter === true;
  const wasOn = useRef(false);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  useEffect(() => {
    if (wasOn.current && !on) onEndedRef.current?.();
    wasOn.current = on;
  }, [on]);
  return on;
}
