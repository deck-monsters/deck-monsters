import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { trpc } from '../lib/trpc.js';

export default function ShopView() {
  const { roomId } = useParams<{ roomId: string }>();
  const [log, setLog] = useState<string[]>([]);
  const [active, setActive] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Capture announce events from the store interaction
  trpc.game.ringFeed.useSubscription(
    { roomId: roomId! },
    {
      enabled: !!roomId && active,
      onData(tracked) {
        const event = tracked.data;
        if (event.scope === 'private' && event.type === 'announce' && event.text) {
          setLog((prev) => [...prev, event.text]);
        }
      },
    },
  );

  const sendCommand = trpc.game.command.useMutation({
    onSuccess: () => {
      setActive(false);
      setDone(true);
    },
    onError: (err) => {
      setActive(false);
      setError(err.message);
    },
  });

  function startFlow(command: string) {
    if (!roomId || active) return;
    setError(null);
    setLog([]);
    setDone(false);
    setActive(true);
    sendCommand.mutate({ roomId, command, isDM: true });
  }

  function handleReset() {
    setLog([]);
    setDone(false);
    setError(null);
    setActive(false);
  }

  if (!roomId) return <div className="empty-state">No room selected.</div>;

  return (
    <div>
      <h1>Shop</h1>

      {error && <div className="error-msg">{error}</div>}

      {!active && !done && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400 }}>
          <p style={{ color: 'var(--text-dim)', margin: 0 }}>
            Browse items for sale or sell items from your inventory. The game will guide you
            through the flow with interactive prompts.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => startFlow('browse the store')}>
              Browse store
            </button>
            <button className="btn" onClick={() => startFlow('sell to the store')}>
              Sell items
            </button>
          </div>
        </div>
      )}

      {active && (
        <div style={{ color: 'var(--text-dim)', marginBottom: 12 }}>
          Shop session active — answer the prompts as they appear…
        </div>
      )}

      {done && (
        <div>
          <div className="success-msg">Shop session complete.</div>
          <button className="btn" style={{ marginTop: 8 }} onClick={handleReset}>
            Shop again
          </button>
        </div>
      )}

      {log.length > 0 && (
        <div className="spawn-log" style={{ marginTop: 16 }}>
          {log.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
