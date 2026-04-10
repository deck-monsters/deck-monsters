import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { trpc } from '../lib/trpc.js';
import AppShell from '../components/AppShell.js';
import { fightSubtitle, fightTitleOneLine, type FightSummaryLike } from '../utils/fight-display.js';

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
    { roomId: roomId ?? '', limit: 80 },
    { enabled: !!roomId }
  );

  const streakByMonsterId = useMemo(() => {
    const list = fights.data ?? [];
    const ids = new Set<string>();
    for (const f of list) {
      for (const p of (f as FightSummaryLike).participants ?? []) {
        if (p.monsterId) ids.add(p.monsterId);
      }
    }
    const map = new Map<string, number>();
    for (const id of ids) {
      let n = 0;
      for (const f of list) {
        const p = (f as FightSummaryLike).participants?.find((x) => x.monsterId === id);
        if (!p) continue;
        if (p.outcome === 'win') n += 1;
        else break;
      }
      map.set(id, n);
    }
    return map;
  }, [fights.data]);

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
          {(fights.data ?? []).map((f) => {
            const fs = f as FightSummaryLike;
            const winners = (fs.participants ?? []).filter((p) => p.outcome === 'win');
            const streakNotes = winners
              .map((w) => {
                const s = streakByMonsterId.get(w.monsterId) ?? 0;
                return s >= 3 ? `${w.monsterName}: ${s}-fight streak` : null;
              })
              .filter(Boolean) as string[];
            return (
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
                  {fightTitleOneLine(fs)}{' '}
                  <span style={{ color: 'var(--color-fg-dim)', fontWeight: 400, fontSize: '0.85rem' }}>
                    {relTime(new Date(f.endedAt))}
                  </span>
                </div>
                <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
                  {fightSubtitle(fs)}
                </div>
                {streakNotes.length > 0 && (
                  <div style={{ fontSize: '0.8rem', marginTop: '0.25rem', color: 'var(--color-accent)' }}>
                    {streakNotes.join(' · ')}
                  </div>
                )}
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
            );
          })}
        </ul>
      </div>
    </AppShell>
  );
}
