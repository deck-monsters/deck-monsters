import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { trpc } from '../lib/trpc.js';

export default function SpawnView() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [log, setLog] = useState<string[]>([]);
  const [spawning, setSpawning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to private announce events so spawn progress appears in this view.
  // Stays active while spawning — do NOT disable on mutation success because
  // game.command is fire-and-forget; the flow continues after the HTTP call returns.
  trpc.game.ringFeed.useSubscription(
    { roomId: roomId! },
    {
      enabled: !!roomId && spawning,
      onData(tracked) {
        const event = tracked.data;
        if (event.scope === 'private' && event.type === 'announce' && event.text) {
          setLog((prev) => [...prev, event.text]);

          // "proud owner of a" is the engine's sentinel that the monster was created.
          if (event.text.includes('proud owner of a')) {
            setSpawning(false);
            setDone(true);
          }
        }
      },
    },
  );

  const sendCommand = trpc.game.command.useMutation({
    onError: (err) => {
      setSpawning(false);
      setError(err.message);
    },
  });

  async function handleSpawn() {
    if (!roomId || spawning) return;
    setError(null);
    setLog([]);
    setDone(false);
    setSpawning(true);

    try {
      const result = await sendCommand.mutateAsync({ roomId, command: 'spawn a monster', isDM: true });

      // game.command returns { ok: true } immediately (fire-and-forget). If ok is
      // false the command was rejected (e.g. concurrent flow lock) — stop here.
      if (!result.ok) {
        setSpawning(false);
        setError((result as { ok: false; message?: string }).message ?? 'Command rejected.');
      }
      // If ok:true the flow is running; stay in spawning mode until the sentinel arrives.
    } catch (err) {
      setSpawning(false);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  function handleDone() {
    setSpawning(false);
    setDone(true);
  }

  function handleReset() {
    setLog([]);
    setDone(false);
    setError(null);
    setSpawning(false);
  }

  if (!roomId) return <div className="empty-state">No room selected.</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button className="btn" onClick={() => navigate(`/monsters/${roomId}`)}>
          Monsters
        </button>
        <h1 style={{ margin: 0 }}>Spawn a Monster</h1>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {!spawning && !done && (
        <div className="spawn-intro">
          <p style={{ color: 'var(--text-dim)', marginBottom: 16 }}>
            The game will guide you through choosing your monster's type, gender, name, and
            appearance. Answer each prompt as it appears.
          </p>
          <button className="btn btn-primary" onClick={handleSpawn}>
            Spawn a Monster
          </button>
        </div>
      )}

      {spawning && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: 'var(--text-dim)', marginBottom: 8 }}>
            Spawning in progress — answer the prompts as they appear…
          </div>
          <button className="btn" onClick={handleDone}>
            Done
          </button>
        </div>
      )}

      {done && (
        <div>
          <div className="success-msg">Your monster has been spawned!</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary" onClick={() => navigate(`/monsters/${roomId}`)}>
              View Monsters
            </button>
            <button className="btn" onClick={handleReset}>
              Spawn another
            </button>
          </div>
        </div>
      )}

      {log.length > 0 && (
        <div className="spawn-log">
          {log.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
