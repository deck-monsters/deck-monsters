import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { trpc } from '../lib/trpc.js';

export default function ShopView() {
  const { roomId } = useParams<{ roomId: string }>();
  const [log, setLog] = useState<string[]>([]);
  const [active, setActive] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Capture announce events from the store interaction.
  // Stays active while `active` is true — do NOT disable on mutation success
  // because game.command is fire-and-forget; the interactive flow continues
  // via the ring feed after the HTTP call returns.
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
    onError: (err) => {
      setActive(false);
      setError(err.message);
    },
  });

  async function startFlow(command: string) {
    if (!roomId || active) return;
    setError(null);
    setLog([]);
    setDone(false);
    setActive(true);

    try {
      const result = await sendCommand.mutateAsync({ roomId, command, isDM: true });

      // game.command returns { ok: true } immediately (fire-and-forget). If ok is
      // false the command was rejected — stop here.
      if (!result.ok) {
        setActive(false);
        setError((result as { ok: false; message?: string }).message ?? 'Command rejected.');
      }
      // If ok:true the flow is running; stay active until the user clicks Done.
    } catch (err) {
      setActive(false);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  function handleDone() {
    setActive(false);
    setDone(true);
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
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: 'var(--text-dim)', marginBottom: 8 }}>
            Shop session active — answer the prompts as they appear…
          </div>
          <button className="btn" onClick={handleDone}>
            Done
          </button>
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
