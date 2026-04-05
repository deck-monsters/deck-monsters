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

  // Subscribe to private announce events so spawn progress appears in this view
  trpc.game.ringFeed.useSubscription(
    { roomId: roomId! },
    {
      enabled: !!roomId && spawning,
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
      setSpawning(false);
      setDone(true);
    },
    onError: (err) => {
      setSpawning(false);
      setError(err.message);
    },
  });

  function handleSpawn() {
    if (!roomId || spawning) return;
    setError(null);
    setLog([]);
    setDone(false);
    setSpawning(true);
    sendCommand.mutate({ roomId, command: 'spawn a monster', isDM: true });
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
        <div style={{ color: 'var(--text-dim)', marginBottom: 12 }}>
          Spawning in progress — answer the prompts as they appear…
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
