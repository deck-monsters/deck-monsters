import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { trpc } from '../lib/trpc.js';
import AppShell from '../components/AppShell.js';

function relTime(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 120) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 120) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export default function FightLogView() {
  const { roomId } = useParams<{ roomId: string }>();
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: room } = trpc.room.info.useQuery(
    { roomId: roomId ?? '' },
    { enabled: !!roomId }
  );

  const fights = trpc.game.recentFights.useQuery(
    { roomId: roomId ?? '', limit: 20 },
    { enabled: !!roomId }
  );

  const detail = trpc.game.fight.useQuery(
    { roomId: roomId ?? '', fightNumber: expanded ?? 0 },
    { enabled: !!roomId && expanded !== null }
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
      <div style={{ padding: '1.5rem', maxWidth: 800, margin: '0 auto', overflowY: 'auto', flex: 1 }}>
        <h1 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--color-fg-bright)' }}>
          Fight log — {room?.name ?? '…'}
        </h1>

        {fights.isLoading && <p style={{ color: 'var(--color-fg-dim)' }}>Loading…</p>}

        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {(fights.data ?? []).map((f) => (
            <li
              key={f.id}
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                padding: '0.75rem',
                marginBottom: '0.5rem',
                background: 'var(--color-bg-elevated, var(--color-bg))',
              }}
            >
              <button
                type="button"
                onClick={() => setExpanded(expanded === f.fightNumber ? null : f.fightNumber)}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  width: '100%',
                  display: 'block',
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  #{f.fightNumber}{' '}
                  {f.winnerMonsterName ?? '?'} vs {f.loserMonsterName ?? '?'}{' '}
                  <span style={{ color: 'var(--color-fg-dim)', fontWeight: 400, fontSize: '0.85rem' }}>
                    {relTime(new Date(f.endedAt))}
                  </span>
                </div>
                <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
                  {f.outcome === 'draw' && 'Draw'}
                  {f.outcome === 'fled' && `${f.winnerMonsterName} fled`}
                  {f.outcome === 'permaDeath' && `${f.winnerMonsterName} won — permadeath`}
                  {f.outcome === 'win' && `${f.winnerMonsterName} won in ${f.roundCount} rounds`}
                  {f.cardDropName && ` · Card: ${f.cardDropName}`}
                </div>
              </button>
              {expanded === f.fightNumber && detail.data && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', fontFamily: 'var(--font-mono, monospace)' }}>
                  <p style={{ marginBottom: '0.35rem', color: 'var(--color-fg-dim)' }}>Event trace (same window)</p>
                  <ol style={{ maxHeight: 240, overflow: 'auto', paddingLeft: '1rem' }}>
                    {detail.data.events.map((ev) => (
                      <li key={ev.id} style={{ marginBottom: '0.25rem' }}>
                        <span style={{ color: 'var(--color-fg-dim)' }}>{ev.type}</span> — {ev.text.slice(0, 200)}
                        {ev.text.length > 200 ? '…' : ''}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
