import React, { useContext } from 'react';
import { RosterSpriteContext } from './roster-sprite-context.js';
import {
  describeContestant,
  formatLevel,
  isDense,
  metaParts,
  teamsAreRelevant,
  teamsInPlay,
  turnPositions,
  type TurnPosition,
} from './roster-model.js';

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

export { formatLevel };

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

/** Turn gutter. Order of play is the row order; this says where in it we are. */
function TurnMarker({ position }: { position: TurnPosition }) {
  const glyph = position === 'acting' ? '▶' : position === 'next' ? '›' : '·';
  return (
    <span className={`roster-turn roster-turn-${position ?? 'idle'}`} aria-hidden="true">
      {glyph}
    </span>
  );
}

function HealthMeter({
  contestant,
  dense,
}: {
  contestant: RingContestantSnapshot;
  dense: boolean;
}) {
  const ratio = hpRatio(contestant.hp, contestant.maxHp);
  const band = contestant.dead ? 'critical' : hpBand(ratio);
  return (
    <div
      className="roster-bar-track"
      role="meter"
      aria-valuenow={Math.max(0, contestant.hp)}
      aria-valuemin={0}
      aria-valuemax={Math.max(contestant.maxHp, 0)}
      aria-label={`${contestant.name} health`}
      // The bar and the numbers say the same thing, so the bar is the quieter of the two:
      // thin, and directly under (comfortable) or beside (dense) the figure it restates.
      data-dense={dense ? 'true' : undefined}
    >
      <div
        className={`roster-bar-fill roster-bar-${band}`}
        style={{ width: `${Math.round(ratio * 100)}%` }}
      />
    </div>
  );
}

function ContestantIcon({ contestant }: { contestant: RingContestantSnapshot }) {
  // Null unless the pixel-art theme feature and the player's opt-in are both on. The
  // sprite is drawn at the same 24px the emoji occupies, so the two are interchangeable
  // and a room with the animations off loses nothing but the motion.
  const sprites = useContext(RosterSpriteContext);
  const sprite = sprites?.render(contestant) ?? null;
  if (sprite) return <span className="roster-icon">{sprite}</span>;
  if (contestant.icon) {
    return (
      <span className="roster-icon roster-icon-emoji" aria-hidden="true">
        {contestant.icon}
      </span>
    );
  }
  return <span className="roster-icon" aria-hidden="true" />;
}

function ContestantRow({
  contestant,
  isMine,
  showTeam,
  position,
  dense,
}: {
  contestant: RingContestantSnapshot;
  isMine: boolean;
  showTeam: boolean;
  position: TurnPosition;
  dense: boolean;
}) {
  const isActing = position === 'acting';
  const parts = metaParts(contestant, showTeam);
  const beastmaster = parts.find((part) => part.kind === 'beastmaster');

  const classes = [
    'roster-row',
    dense ? 'roster-row-dense' : 'roster-row-full',
    contestant.dead ? 'roster-row-dead' : '',
    isMine ? 'roster-row-mine' : '',
    isActing ? 'roster-row-acting' : '',
  ].filter(Boolean).join(' ');

  return (
    <li className={classes} aria-label={describeContestant(contestant, position)}>
      <TurnMarker position={position} />
      <ContestantIcon contestant={contestant} />

      {dense ? (
        // One line: name and beastmaster share the slack, then the meter and the figure.
        // Level and AC are the only fields that go — the two the panel is read for least.
        <>
          <span className="roster-dense-who">
            <span className="roster-name-text">{contestant.name}</span>
            {showTeam && contestant.team && <TeamPip team={contestant.team} />}
            {beastmaster && (
              <span className="roster-dense-by"> {beastmaster.text}</span>
            )}
          </span>
          {contestant.isBoss && <span className="roster-tag roster-tag-boss">BOSS</span>}
          <HealthMeter contestant={contestant} dense />
          <span className="roster-hp">
            {contestant.dead ? <span className="roster-dead-text">fallen</span> : `${contestant.hp}/${contestant.maxHp}`}
          </span>
        </>
      ) : (
        <>
          <div className="roster-row-body">
            {/* Nothing shares this line with the name but the boss badge, so the name
                gets every pixel left after the rail — it is the field the narration
                names monsters by, and the one that used to collapse to "G..". */}
            <div className="roster-row-head">
              <span className="roster-name-text">{contestant.name}</span>
              {contestant.isBoss && <span className="roster-tag roster-tag-boss">BOSS</span>}
            </div>
            <div className="roster-row-sub">
              {parts.map((part, index) => (
                <React.Fragment key={part.kind}>
                  {index > 0 && <span className="roster-sub-sep" aria-hidden="true">·</span>}
                  <span className={`roster-sub-${part.kind}`}>
                    {part.kind === 'team' && <TeamPip team={part.text} />}
                    {part.text}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="roster-rail">
            <span className="roster-hp">
              {contestant.dead ? <span className="roster-dead-text">fallen</span> : `${contestant.hp}/${contestant.maxHp}`}
            </span>
            <HealthMeter contestant={contestant} dense={false} />
          </div>
        </>
      )}
    </li>
  );
}

/**
 * Colour-codes a team without reordering the roster.
 *
 * Team names are a closed set (`The Alliance`, the four houses, `Boss`), so a stable
 * colour per team is safe. It is never the only channel: the name sits beside the pip in
 * a comfortable row, and the legend under the list names every colour in play.
 */
function TeamPip({ team }: { team: string }) {
  return (
    <span
      className="roster-team-pip"
      data-team={team.toLowerCase().replace(/[^a-z]+/g, '-')}
      aria-hidden="true"
    />
  );
}

/**
 * Live scoreboard for the monsters currently in the ring.
 *
 * HP and AC are reported in the narration too, but only as prose spread across the
 * feed, so on a phone you had to scroll back through several screens of rolls to work
 * out who was still standing. This keeps the whole board visible while the fight runs.
 *
 * Rows are rendered in the order the engine holds them, which is the order of play, and
 * are never sorted or grouped — see `turnPositions`. Layout and field priority are
 * recorded in `docs/roadmap/23-pixel-fight-stage.md`.
 */
export default function RingRoster({
  contestants,
  myUserId,
  collapsed,
  onToggle,
}: RingRosterProps) {
  if (contestants.length === 0) return null;

  const standing = contestants.filter((c) => !c.dead).length;
  const fallen = contestants.length - standing;
  const showTeam = teamsAreRelevant(contestants);
  const dense = isDense(contestants.length);
  const positions = turnPositions(contestants);

  return (
    <section className="ring-roster" aria-label="Monsters in the ring">
      <button
        type="button"
        className="roster-toggle"
        onClick={onToggle}
        aria-expanded={!collapsed}
      >
        <span aria-hidden="true">{collapsed ? '▸' : '▾'}</span> In the ring —{' '}
        {standing} standing{fallen > 0 ? ` · ${fallen} fallen` : ''}
      </button>

      {!collapsed && (
        <>
          <ol className={`roster-list${dense ? ' roster-list-dense' : ''}`}>
            {contestants.map((contestant) => (
              <ContestantRow
                key={`${contestant.name}-${contestant.userId ?? 'boss'}`}
                contestant={contestant}
                isMine={Boolean(myUserId && contestant.userId === myUserId)}
                showTeam={showTeam}
                position={positions.get(contestant) ?? null}
                dense={dense}
              />
            ))}
          </ol>
          {showTeam && (
            <ul className="roster-legend" aria-label="Teams in play">
              {teamsInPlay(contestants).map((team) => (
                <li key={team}>
                  <TeamPip team={team} />
                  {team}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
