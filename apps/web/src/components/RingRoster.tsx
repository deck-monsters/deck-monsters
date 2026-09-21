import React, { useContext } from 'react';
import { RosterSpriteContext } from './roster-sprite-context.js';

export interface RingContestantSnapshot {
  name: string;
  icon: string;
  creatureType: string;
  level: number;
  hp: number;
  maxHp: number;
  ac: number;
  dead: boolean;
  isBoss: boolean;
  team: string | null;
  owner: string | null;
  userId: string | null;
  /** Optional — older ring.state payloads / the polled seed may omit it. */
  acting?: boolean;
}

interface RingRosterProps {
  contestants: RingContestantSnapshot[];
  /** Highlights the viewer's own monsters. */
  myUserId?: string | null;
  collapsed: boolean;
  onToggle: () => void;
}

/**
 * Ratio clamped to 0–1. `maxHp` can read 0 on a partially hydrated entity, and a
 * monster can be driven below 0 hp by an overkill hit — both would otherwise produce
 * a bar that renders inverted or overflows its track.
 */
export function hpRatio(hp: number, maxHp: number): number {
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0) return 0;
  return Math.max(0, Math.min(1, hp / maxHp));
}

/** Health band drives the bar colour: healthy ≥ 50%, hurt ≥ 20%, critical below. */
export function hpBand(ratio: number): 'healthy' | 'hurt' | 'critical' {
  if (ratio >= 0.5) return 'healthy';
  if (ratio >= 0.2) return 'hurt';
  return 'critical';
}

/**
 * Level 0 is not a level — it is how the engine represents a monster that has not
 * earned any XP yet. `describeLevels` renders it as "beginner" and the monster stat
 * card shows "Level: beginner", so a roster reading "lvl 0" contradicted the rest of
 * the game.
 */
export function formatLevel(level: number): string {
  return level > 0 ? `lvl ${level}` : 'beginner';
}

function ContestantRow({
  contestant,
  isMine,
}: {
  contestant: RingContestantSnapshot;
  isMine: boolean;
}) {
  const ratio = hpRatio(contestant.hp, contestant.maxHp);
  const band = contestant.dead ? 'critical' : hpBand(ratio);
  const isActing = Boolean(contestant.acting) && !contestant.dead;
  // Null unless the pixel-art theme feature and the player's opt-in are both on.
  const sprites = useContext(RosterSpriteContext);
  const sprite = sprites?.render(contestant) ?? null;
  const label = `${contestant.name}, ${contestant.dead ? 'defeated' : `${contestant.hp} of ${contestant.maxHp} hit points`}, armor class ${contestant.ac}${isActing ? ', acting now' : ''}`;

  return (
    <li
      className={`roster-row${contestant.dead ? ' roster-row-dead' : ''}${isMine ? ' roster-row-mine' : ''}${isActing ? ' roster-row-acting' : ''}`}
      aria-label={label}
    >
      {/* A sprite sits in the row's left gutter, spanning all three lines, so it uses
          height the row already had. The icon stays in the name line when there is no
          sprite — and is dropped when there is one, since it would say the same thing
          twice. */}
      {sprite && <div className="roster-sprite-cell">{sprite}</div>}

      <div className="roster-row-body">
      <div className="roster-row-head">
        <span className="roster-name">
          {isActing && (
            <span className="roster-acting-marker" aria-hidden="true">▶</span>
          )}
          {contestant.icon && !sprite && (
            <span className="roster-icon" aria-hidden="true">{contestant.icon} </span>
          )}
          <span className="roster-name-text">{contestant.name}</span>
          {contestant.isBoss && <span className="roster-tag roster-tag-boss">BOSS</span>}
          {contestant.team && <span className="roster-tag">{contestant.team}</span>}
        </span>
        <span className="roster-numbers">
          {contestant.dead ? (
            <span className="roster-dead-text">defeated</span>
          ) : (
            <>
              <span className="roster-hp">
                {contestant.hp}/{contestant.maxHp}
              </span>
              <span className="roster-ac" title="Armor class">
                ac {contestant.ac}
              </span>
            </>
          )}
        </span>
      </div>

      <div
        className="roster-bar-track"
        role="meter"
        aria-valuenow={Math.max(0, contestant.hp)}
        aria-valuemin={0}
        aria-valuemax={Math.max(contestant.maxHp, 0)}
        aria-label={`${contestant.name} health`}
      >
        <div
          className={`roster-bar-fill roster-bar-${band}`}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>

      <div className="roster-row-sub">
        {contestant.creatureType} · {formatLevel(contestant.level)}
        {contestant.owner ? ` · ${contestant.owner}` : ''}
      </div>
      </div>
    </li>
  );
}

/**
 * Live scoreboard for the monsters currently in the ring.
 *
 * HP and AC are reported in the narration too, but only as prose spread across the
 * feed, so on a phone you had to scroll back through several screens of rolls to work
 * out who was still standing. This keeps the whole board visible while the fight runs.
 */
export default function RingRoster({
  contestants,
  myUserId,
  collapsed,
  onToggle,
}: RingRosterProps) {
  if (contestants.length === 0) return null;

  const standing = contestants.filter((c) => !c.dead).length;

  return (
    <section className="ring-roster" aria-label="Monsters in the ring">
      <button
        type="button"
        className="roster-toggle"
        onClick={onToggle}
        aria-expanded={!collapsed}
      >
        <span aria-hidden="true">{collapsed ? '▸' : '▾'}</span> In the ring —{' '}
        {standing}/{contestants.length} standing
      </button>

      {!collapsed && (
        <ol className="roster-list">
          {contestants.map((contestant) => (
            <ContestantRow
              key={`${contestant.name}-${contestant.userId ?? 'boss'}`}
              contestant={contestant}
              isMine={Boolean(myUserId && contestant.userId === myUserId)}
            />
          ))}
        </ol>
      )}
    </section>
  );
}
