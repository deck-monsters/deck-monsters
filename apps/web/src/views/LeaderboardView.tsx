import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { trpc } from '../lib/trpc.js';
import AppShell from '../components/AppShell.js';

type Scope = 'room' | 'global';
type Kind = 'players' | 'monsters';
type Sort = 'xp' | 'wins' | 'winRate' | 'coins';

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export default function LeaderboardView() {
  const { roomId } = useParams<{ roomId?: string }>();
  const [scope, setScope] = useState<Scope>(roomId ? 'room' : 'global');
  const [kind, setKind] = useState<Kind>('players');
  const [sortBy, setSortBy] = useState<Sort>('xp');

  const { data: room } = trpc.room.info.useQuery(
    { roomId: roomId ?? '' },
    { enabled: !!roomId }
  );

  const roomPlayers = trpc.leaderboard.roomPlayers.useQuery(
    { roomId: roomId ?? '', limit: 25, sortBy },
    { enabled: !!roomId && scope === 'room' && kind === 'players' }
  );
  const roomMonsters = trpc.leaderboard.roomMonsters.useQuery(
    { roomId: roomId ?? '', limit: 25, sortBy },
    { enabled: !!roomId && scope === 'room' && kind === 'monsters' }
  );
  const globalPlayers = trpc.leaderboard.globalPlayers.useQuery(
    { limit: 25, sortBy },
    { enabled: scope === 'global' && kind === 'players' }
  );
  const globalMonsters = trpc.leaderboard.globalMonsters.useQuery(
    { limit: 25, sortBy },
    { enabled: scope === 'global' && kind === 'monsters' }
  );

  const loading =
    roomPlayers.isLoading ||
    roomMonsters.isLoading ||
    globalPlayers.isLoading ||
    globalMonsters.isLoading;

  return (
    <AppShell roomName={room?.name} roomId={roomId}>
      <div style={{ padding: '1.5rem', maxWidth: 960, margin: '0 auto', overflowY: 'auto', flex: 1 }}>
        <h1 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--color-fg-bright)' }}>
          Leaderboard
        </h1>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
          <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.85rem' }}>
            <input
              type="radio"
              name="scope"
              checked={scope === 'room'}
              onChange={() => setScope('room')}
              disabled={!roomId}
            />
            This room
          </label>
          <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.85rem' }}>
            <input
              type="radio"
              name="scope"
              checked={scope === 'global'}
              onChange={() => setScope('global')}
            />
            Global
          </label>
          <span style={{ color: 'var(--color-border)' }}>|</span>
          <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.85rem' }}>
            <input
              type="radio"
              name="kind"
              checked={kind === 'players'}
              onChange={() => setKind('players')}
            />
            Players
          </label>
          <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.85rem' }}>
            <input
              type="radio"
              name="kind"
              checked={kind === 'monsters'}
              onChange={() => setKind('monsters')}
            />
            Monsters
          </label>
          <span style={{ flex: 1 }} />
          <label style={{ fontSize: '0.85rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            Sort by
            <select
              className="btn"
              style={{ fontSize: '0.8rem' }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as Sort)}
            >
              <option value="xp">XP</option>
              <option value="wins">Wins</option>
              <option value="winRate">Win rate</option>
              <option value="coins">Coins</option>
            </select>
          </label>
        </div>

        {!roomId && scope === 'room' && (
          <p style={{ color: 'var(--color-fg-dim)' }}>Join a room to see room-scoped rankings, or switch to Global.</p>
        )}

        {loading && <p style={{ color: 'var(--color-fg-dim)' }}>Loading…</p>}

        {kind === 'players' && scope === 'room' && roomId && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.35rem' }}>#</th>
                <th style={{ padding: '0.35rem' }}>Name</th>
                <th style={{ padding: '0.35rem' }}>XP</th>
                <th style={{ padding: '0.35rem' }}>W</th>
                <th style={{ padding: '0.35rem' }}>L</th>
                <th style={{ padding: '0.35rem' }}>D</th>
                <th
                  style={{ padding: '0.35rem' }}
                  title="Wins ÷ (wins + losses). Draws excluded."
                >
                  Win %
                </th>
              </tr>
            </thead>
            <tbody>
              {(roomPlayers.data ?? []).map((r) => (
                <tr key={r.rank} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.35rem' }}>{r.rank}</td>
                  <td style={{ padding: '0.35rem' }}>{r.displayName}</td>
                  <td style={{ padding: '0.35rem' }}>{r.xp}</td>
                  <td style={{ padding: '0.35rem' }}>{r.wins}</td>
                  <td style={{ padding: '0.35rem' }}>{r.losses}</td>
                  <td style={{ padding: '0.35rem' }}>{r.draws}</td>
                  <td style={{ padding: '0.35rem' }}>{pct(r.winRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {kind === 'monsters' && scope === 'room' && roomId && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.35rem' }}>#</th>
                <th style={{ padding: '0.35rem' }}>Name</th>
                <th style={{ padding: '0.35rem' }}>Type</th>
                <th style={{ padding: '0.35rem' }}>Owner</th>
                <th style={{ padding: '0.35rem' }}>XP</th>
                <th style={{ padding: '0.35rem' }}>Lv</th>
                <th
                  style={{ padding: '0.35rem' }}
                  title="Wins ÷ (wins + losses). Draws excluded."
                >
                  Win %
                </th>
                <th style={{ padding: '0.35rem' }} title="Consecutive wins in recent fights (this room)">
                  Streak
                </th>
              </tr>
            </thead>
            <tbody>
              {(roomMonsters.data ?? []).map((r) => (
                <tr key={r.rank} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.35rem' }}>{r.rank}</td>
                  <td style={{ padding: '0.35rem' }}>
                    {r.displayName}
                    {r.winStreak >= 3 && (
                      <span
                        style={{
                          marginLeft: '0.35rem',
                          fontSize: '0.75rem',
                          padding: '0.1rem 0.35rem',
                          borderRadius: 4,
                          background: 'var(--color-accent-muted, rgba(255,200,0,0.15))',
                          color: 'var(--color-accent)',
                        }}
                        title="Active win streak"
                      >
                        {r.winStreak}W
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.35rem' }}>{r.monsterType}</td>
                  <td style={{ padding: '0.35rem' }}>{r.ownerName ?? '—'}</td>
                  <td style={{ padding: '0.35rem' }}>{r.xp}</td>
                  <td style={{ padding: '0.35rem' }}>{r.level}</td>
                  <td style={{ padding: '0.35rem' }}>{pct(r.winRate)}</td>
                  <td style={{ padding: '0.35rem' }}>{r.winStreak > 0 ? r.winStreak : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {kind === 'players' && scope === 'global' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.35rem' }}>#</th>
                <th style={{ padding: '0.35rem' }}>Name</th>
                <th style={{ padding: '0.35rem' }}>XP</th>
                <th style={{ padding: '0.35rem' }}>Rooms</th>
                <th
                  style={{ padding: '0.35rem' }}
                  title="Wins ÷ (wins + losses), aggregated across rooms. Draws excluded."
                >
                  Win %
                </th>
              </tr>
            </thead>
            <tbody>
              {(globalPlayers.data ?? []).map((r) => (
                <tr key={r.rank} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.35rem' }}>{r.rank}</td>
                  <td style={{ padding: '0.35rem' }}>{r.displayName}</td>
                  <td style={{ padding: '0.35rem' }}>{r.xp}</td>
                  <td style={{ padding: '0.35rem' }}>{r.roomCount}</td>
                  <td style={{ padding: '0.35rem' }}>{pct(r.winRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {kind === 'monsters' && scope === 'global' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.35rem' }}>#</th>
                <th style={{ padding: '0.35rem' }}>Name</th>
                <th style={{ padding: '0.35rem' }}>Type</th>
                <th style={{ padding: '0.35rem' }}>Owner</th>
                <th style={{ padding: '0.35rem' }}>XP</th>
                <th
                  style={{ padding: '0.35rem' }}
                  title="Wins ÷ (wins + losses), aggregated across rooms. Draws excluded."
                >
                  Win %
                </th>
              </tr>
            </thead>
            <tbody>
              {(globalMonsters.data ?? []).map((r) => (
                <tr key={r.rank} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.35rem' }}>{r.rank}</td>
                  <td style={{ padding: '0.35rem' }}>{r.displayName}</td>
                  <td style={{ padding: '0.35rem' }}>{r.monsterType}</td>
                  <td style={{ padding: '0.35rem' }}>{r.ownerName ?? '—'}</td>
                  <td style={{ padding: '0.35rem' }}>{r.xp}</td>
                  <td style={{ padding: '0.35rem' }}>{pct(r.winRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
