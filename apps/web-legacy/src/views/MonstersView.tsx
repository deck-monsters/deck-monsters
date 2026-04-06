import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { trpc } from '../lib/trpc.js';

interface MonsterInfo {
  name: string;
  type: string;
  hp: number;
  maxHp: number;
  level: number;
  ac: number;
}

function parseMonsters(text: string): MonsterInfo[] {
  // The engine outputs monster info as text lines. We do a best-effort parse
  // for display; detailed monster views come from the ring feed.
  const lines = text.split('\n').filter(Boolean);
  const monsters: MonsterInfo[] = [];

  let current: Partial<MonsterInfo> | null = null;
  for (const line of lines) {
    const nameMatch = /^\s*(?:\d+\.\s+)?(.+?)\s*\((\w+)\)/.exec(line);
    if (nameMatch) {
      if (current?.name) monsters.push(current as MonsterInfo);
      current = {
        name: nameMatch[1]!,
        type: nameMatch[2]!,
        hp: 0,
        maxHp: 0,
        level: 1,
        ac: 10,
      };
    }
    if (current) {
      const hpMatch = /HP[:\s]+(\d+)\s*\/\s*(\d+)/i.exec(line);
      if (hpMatch) { current.hp = parseInt(hpMatch[1]!); current.maxHp = parseInt(hpMatch[2]!); }
      const lvlMatch = /Level[:\s]+(\d+)/i.exec(line);
      if (lvlMatch) current.level = parseInt(lvlMatch[1]!);
      const acMatch = /AC[:\s]+(\d+)/i.exec(line);
      if (acMatch) current.ac = parseInt(acMatch[1]!);
    }
  }
  if (current?.name) monsters.push(current as MonsterInfo);
  return monsters;
}

export default function MonstersView() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [output, setOutput] = useState<string[]>([]);
  const [monsters, setMonsters] = useState<MonsterInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  // true once the user has explicitly asked to load their monster list
  const [loaded, setLoaded] = useState(false);

  const sendCommand = trpc.game.command.useMutation({
    onError: (err) => setError(err.message),
  });

  // Subscribe to ring feed to capture monster list output.
  // Only enabled once the user has explicitly triggered a load.
  trpc.game.ringFeed.useSubscription(
    { roomId: roomId! },
    {
      enabled: !!roomId && loaded,
      onData(tracked) {
        const event = tracked.data;
        if (event.scope === 'private' && event.text) {
          setOutput((prev) => {
            const next = [...prev, event.text];
            const combined = next.join('\n');
            const parsed = parseMonsters(combined);
            if (parsed.length > 0) setMonsters(parsed);
            return next;
          });
        }
      },
    }
  );

  function loadMonsters() {
    if (!roomId) return;
    setError(null);
    setOutput([]);
    setMonsters([]);
    setLoaded(true);
    sendCommand.mutate({ roomId, command: 'look at monsters', isDM: true });
  }

  function sendToRing(name: string) {
    if (!roomId) return;
    setError(null);
    sendCommand.mutate({ roomId, command: `send ${name} to the ring` });
    navigate(`/ring/${roomId}`);
  }

  if (!roomId) return <div className="empty-state">No room selected.</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Monsters</h1>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={() => navigate(`/spawn/${roomId}`)}>
          Spawn new
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {!loaded && (
        <div className="empty-state">
          <p>View your monsters to get started.</p>
          <button className="btn btn-primary" onClick={loadMonsters}>
            Load monsters
          </button>
        </div>
      )}

      {loaded && monsters.length === 0 && (
        <div className="empty-state">
          {sendCommand.isPending
            ? 'Loading your monsters…'
            : 'No monsters yet. Spawn one to get started!'}
        </div>
      )}

      <div className="monster-grid">
        {monsters.map((m) => {
          const hpPct = m.maxHp > 0 ? m.hp / m.maxHp : 0;
          const hpClass = hpPct < 0.25 ? 'dead' : hpPct < 0.5 ? 'low' : '';
          return (
            <div key={m.name} className="monster-card">
              <p className="monster-card-name">{m.name}</p>
              <p className="monster-card-meta">
                {m.type} · Lv {m.level} · AC {m.ac}
              </p>
              {m.maxHp > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 3 }}>
                    {m.hp}/{m.maxHp} HP
                  </div>
                  <div className="hp-bar">
                    <div
                      className={`hp-bar-fill ${hpClass}`}
                      style={{ width: `${hpPct * 100}%` }}
                    />
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-primary" onClick={() => sendToRing(m.name)}>
                  Ring
                </button>
                <button
                  className="btn"
                  onClick={() => navigate(`/deck/${roomId}/${encodeURIComponent(m.name)}`)}
                >
                  Deck
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Raw output panel for debugging / full text view */}
      {output.length > 0 && (
        <details style={{ marginTop: 20 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--text-dim)', fontSize: 12 }}>
            Raw output
          </summary>
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: 12,
              marginTop: 8,
            }}
          >
            {output.join('\n')}
          </div>
        </details>
      )}
    </div>
  );
}
