import { useParams } from 'react-router-dom';
import AppShell from '../components/AppShell.js';
import LeaderboardPanel from '../components/LeaderboardPanel.js';
import { trpc } from '../lib/trpc.js';

export default function LeaderboardView() {
  const { roomId } = useParams<{ roomId?: string }>();
  const { data: room } = trpc.room.info.useQuery(
    { roomId: roomId ?? '' },
    { enabled: !!roomId }
  );
  return <AppShell roomName={room?.name} roomId={roomId}>
    <LeaderboardPanel roomId={roomId} />
  </AppShell>;
}
