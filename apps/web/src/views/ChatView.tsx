import { useParams } from 'react-router-dom';
import { trpc } from '../lib/trpc.js';
import AppShell from '../components/AppShell.js';
import ChatPanel from '../components/ChatPanel.js';
import { RingFeedProvider } from '../hooks/useRingFeed.js';
import { ChatProvider } from '../hooks/useChat.js';

/**
 * Full-page host for the Chat surface. Inside `Terminal` the room's feed and chat state come
 * from the shared providers; this standalone route never mounts `Terminal`, so it brings its
 * own (chat frames ride the `ringFeed` connection).
 */
export default function ChatView() {
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
      <RingFeedProvider roomId={roomId}>
        <ChatProvider roomId={roomId}>
          <ChatPanel roomId={roomId} />
        </ChatProvider>
      </RingFeedProvider>
    </AppShell>
  );
}
