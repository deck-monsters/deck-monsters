import { useParams } from 'react-router-dom';
import AppShell from '../components/AppShell.js';
import WorkshopPanel from '../components/WorkshopPanel.js';
import { trpc } from '../lib/trpc.js';

export type { SelectionState } from '../components/WorkshopPanel.js';

export default function WorkshopView() {
  const { roomId } = useParams<{ roomId: string }>();

  // Only `roomName` is needed here, for AppShell's header — the rest of the workshop's data
  // (monsters, inventory, mutations) lives in WorkshopPanel via useDeckWorkshop. This calls
  // the same `room.info` query that useDeckWorkshop calls internally; react-query dedupes by
  // query key against the shared client, so this does not add a second network request. This
  // mirrors the existing App.tsx/FightLogView.tsx/LeaderboardView.tsx pattern of fetching
  // `room.info` in the view purely to feed AppShell.
  const { data: room } = trpc.room.info.useQuery({ roomId: roomId ?? '' }, { enabled: !!roomId });

  return (
    <AppShell roomName={room?.name} roomId={roomId}>
      <WorkshopPanel roomId={roomId} />
    </AppShell>
  );
}
