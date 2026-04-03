import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { trpc } from '../lib/trpc.js';

interface FeedEntry {
  id: string;
  type: string;
  text: string;
  timestamp: number;
}

export default function RingFeedView() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [command, setCommand] = useState('');
  const [cmdError, setCmdError] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<string | undefined>(undefined);

  const roomInfo = trpc.room.info.useQuery(
    { roomId: roomId! },
    { enabled: !!roomId }
  );

  // Live ring feed subscription
  trpc.game.ringFeed.useSubscription(
    { roomId: roomId!, lastEventId: lastIdRef.current },
    {
      enabled: !!roomId,
      onData(tracked) {
        const event = tracked.data;
        lastIdRef.current = tracked.id;
        setEntries((prev) => {
          // Avoid duplicate entries from catch-up + live overlap
          if (prev.some((e) => e.id === tracked.id)) return prev;
          return [
            ...prev,
            {
              id: tracked.id,
              type: event.type,
              text: event.text,
              timestamp: event.timestamp,
            },
          ];
        });
      },
    }
  );

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);

  const sendCommand = trpc.game.command.useMutation({
    onError: (err) => setCmdError(err.message),
  });

  function handleCommand(e: React.FormEvent) {
    e.preventDefault();
    if (!command.trim() || !roomId) return;
    setCmdError(null);
    sendCommand.mutate({ roomId, command: command.trim() });
    setCommand('');
  }

  if (!roomId) return <div className="empty-state">No room selected.</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>
          {roomInfo.data ? roomInfo.data.name : 'Ring Feed'}
        </h1>
        {roomInfo.data && (
          <span className="tag">{roomInfo.data.memberCount} players</span>
        )}
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => navigate(`/monsters/${roomId}`)}>
          Monsters
        </button>
        <button className="btn" onClick={() => navigate(`/shop/${roomId}`)}>
          Shop
        </button>
        <button className="btn" onClick={() => navigate(`/spawn/${roomId}`)}>
          Spawn
        </button>
      </div>

      {/* Ring feed */}
      <div className="ring-feed" ref={feedRef}>
        {entries.length === 0 && (
          <span style={{ color: 'var(--text-dim)' }}>
            Waiting for battle events… Send a monster to the ring to get started.
          </span>
        )}
        {entries.map((entry) => (
          <div
            key={entry.id}
            className={`ring-feed-entry ${entry.type}`}
          >
            {entry.text}
          </div>
        ))}
      </div>

      {/* Command input */}
      <form onSubmit={handleCommand} style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="dm send fang to the ring"
          style={{ flex: 1, fontFamily: 'var(--mono)' }}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={sendCommand.isPending}
        >
          Send
        </button>
      </form>
      {cmdError && <div className="error-msg" style={{ marginTop: 8 }}>{cmdError}</div>}

      <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
        Type commands like you would in Slack/Discord. Examples:{' '}
        <code style={{ fontFamily: 'var(--mono)' }}>spawn a basilisk named Fang</code>,{' '}
        <code style={{ fontFamily: 'var(--mono)' }}>send Fang to the ring</code>,{' '}
        <code style={{ fontFamily: 'var(--mono)' }}>look at my monsters</code>
      </p>
    </div>
  );
}
