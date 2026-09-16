import { useMemo, useState, type ReactNode } from 'react';
import { trpc } from '../lib/trpc.js';
import { formatEventText, truncateEventText } from '../utils/format-event-text.js';
import { fightSubtitle, fightTitleOneLine, type FightSummaryLike } from '../utils/fight-display.js';

interface FightLogPanelProps { roomId: string; headerActions?: ReactNode }

function relTime(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 120) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return m < 120 ? `${m} min ago` : `${Math.floor(m / 60)}h ago`;
}

export default function FightLogPanel({ roomId, headerActions }: FightLogPanelProps) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const fights = trpc.game.recentFights.useQuery({ roomId, limit: 80 });
  const detail = trpc.game.fight.useQuery(
    { roomId, fightNumber: expanded ?? 0 },
    { enabled: expanded !== null }
  );
  const streakByMonsterId = useMemo(() => {
    const list = fights.data ?? [];
    const ids = new Set(list.flatMap((f) => (f as FightSummaryLike).participants ?? []).map((p) => p.monsterId));
    return new Map([...ids].map((id) => {
      let streak = 0;
      for (const fight of list) {
        const participant = (fight as FightSummaryLike).participants?.find((p) => p.monsterId === id);
        if (!participant) continue;
        if (participant.outcome !== 'win') break;
        streak += 1;
      }
      return [id, streak];
    }));
  }, [fights.data]);

  return <div className="surface-panel-host"><section className="surface-panel fight-log-panel">
    <header className="surface-panel-heading"><h1>Fight log</h1><div className="surface-panel-actions">{headerActions}</div></header>
    {fights.isLoading && <p className="surface-muted">Loading…</p>}
    <ul className="fight-log-list">{(fights.data ?? []).map((fight) => {
      const summary = fight as FightSummaryLike;
      const streaks = (summary.participants ?? []).filter((p) => p.outcome === 'win')
        .map((p) => ({ name: p.monsterName, count: streakByMonsterId.get(p.monsterId) ?? 0 }))
        .filter((streak) => streak.count >= 3);
      const open = expanded === fight.fightNumber;
      return <li className="fight-log-card" key={fight.id}>
        <button className="fight-log-summary" type="button" aria-expanded={open}
          onClick={() => setExpanded(open ? null : fight.fightNumber)}>
          <strong>#{fight.fightNumber} {fightTitleOneLine(summary)}</strong>{' '}
          <span className="surface-muted">{relTime(new Date(fight.endedAt))}</span>
          <span>{fightSubtitle(summary)}</span>
          {streaks.length > 0 && <span className="fight-streak">{streaks.map((s) => `${s.name}: ${s.count}-fight streak`).join(' · ')}</span>}
        </button>
        {open && detail.data && <div className="fight-log-detail">
          <p className="surface-muted">Events during this fight</p>
          <ol>{detail.data.events.map((event) => <li key={event.id}>
            <span className="surface-muted">{event.type}</span> — {formatEventText(truncateEventText(event.text, 200))}
          </li>)}</ol>
        </div>}
      </li>;
    })}</ul>
  </section></div>;
}
