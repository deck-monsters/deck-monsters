import { useParams } from 'react-router-dom';
import AppShell from '../components/AppShell.js';
import WorkshopPanel from '../components/WorkshopPanel.js';
import { trpc } from '../lib/trpc.js';

export type { SelectionState } from '../components/WorkshopPanel.js';

/**
 * Full-page host for the workshop surface. The surface itself is `WorkshopPanel`, which
 * also renders inside a terminal pane — see `docs/roadmap/20-workspace-layout.md` §3.1.
 * This host adds only the app chrome.
 */
export default function WorkshopView() {
  const { roomId } = useParams<{ roomId: string }>();

  // Only the room's name is needed here, for AppShell's header. Fetched directly rather
  // than via useDeckWorkshop, matching FightLogView and LeaderboardView: `room.info` is a
  // plain cached query, so a second observer of it costs nothing, whereas useDeckWorkshop
  // also opens `myInventory` with `refetchInterval: 30_000` — and refetch intervals are
  // per-observer, so calling the hook here as well as in the panel would double the
  // workshop's background polling.
  const { data: room } = trpc.room.info.useQuery(
    { roomId: roomId ?? '' },
    { enabled: !!roomId },
  );

  return (
    <AppShell roomName={room?.name} roomId={roomId}>
      <WorkshopPanel roomId={roomId} />
    </AppShell>
  );
}
