import { useParams } from 'react-router-dom';
import AppShell from '../components/AppShell.js';
import HelpPanel from '../components/HelpPanel.js';
import { trpc } from '../lib/trpc.js';

/**
 * Full-page host for the Help surface, at `/help` (from anywhere) and
 * `/room/:roomId/help`. The surface itself is `HelpPanel`, which also renders in a
 * terminal pane. The guides are static, so the panel needs no room; the room only supplies
 * the header's room name. See `docs/architecture/web-workspace.md`.
 */
export default function HelpView() {
  const { roomId } = useParams<{ roomId?: string }>();
  const { data: room } = trpc.room.info.useQuery({ roomId: roomId ?? '' }, { enabled: !!roomId });
  return (
    <AppShell roomName={room?.name} roomId={roomId}>
      <HelpPanel />
    </AppShell>
  );
}
