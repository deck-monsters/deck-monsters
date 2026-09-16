import { useParams } from 'react-router-dom';
import { trpc } from '../lib/trpc.js';
import AppShell from '../components/AppShell.js';
import FightLogPanel from '../components/FightLogPanel.js';

export default function FightLogView() {
  const { roomId } = useParams<{ roomId: string }>();
  const { data: room } = trpc.room.info.useQuery(
    { roomId: roomId ?? '' },
    { enabled: !!roomId }
  );

  if (!roomId) {
    return (
      <AppShell>
        <p style={{ padding: '1rem' }}>No room selected.</p>
      </AppShell>
    );
  }

  return (
    <AppShell roomName={room?.name} roomId={roomId}>
      <FightLogPanel roomId={roomId} />
    </AppShell>
  );
}
