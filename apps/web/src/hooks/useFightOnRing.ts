import { trpc } from '../lib/trpc.js';

/**
 * Whether a fight is on the ring right now, for panels that report on fights after they
 * end (the Fights and Leaders panels; roadmap 39 B2).
 *
 * Reads the same room-scoped, membership-checked `game.ringState` query RingPane uses, so
 * the two share one cache entry per room. The short refetch interval is what lets an empty
 * panel change its line when a fight starts or ends without the Ring pane being mounted.
 * It only polls while a fight is on or the answer is unknown, so a quiet room costs nothing
 * beyond RingPane's own 60 s refresh.
 */
export const FIGHT_ON_RING_POLL_MS = 5_000;

export function useFightOnRing(roomId: string | undefined): boolean {
  const ringState = trpc.game.ringState.useQuery(
    { roomId: roomId ?? '' },
    {
      enabled: !!roomId,
      refetchInterval: (query: { state: { data?: { inEncounter?: boolean } } }) =>
        query.state.data?.inEncounter ? FIGHT_ON_RING_POLL_MS : 60_000,
    },
  );
  return ringState.data?.inEncounter === true;
}
