import type { RingContestantSnapshot } from './RingRoster.js';

/**
 * Above this many contestants the roster asks to be compressed.
 *
 * "Asks" because the decision is finished in CSS: `isDense` only adds a class, and the
 * stylesheet honours it in the single-column tier alone. At two columns twelve
 * contestants is six rows a side and at three it is four, so a big fight on a wide pane
 * gets columns rather than compressed rows. Narrow and busy is the only combination
 * worth compressing.
 *
 * The roster is capped at 40% of the pane height and scrolls inside that, so a big fight
 * could never push the feed off screen — but on one column it could bury everyone below
 * the fold. Eight is a judgement call: the largest count that still fits the cap
 * comfortably on a phone.
 */
export const DENSE_ABOVE = 8;

export function isDense(contestantCount: number): boolean {
  return contestantCount > DENSE_ABOVE;
}

/**
 * Teams earn their place in a row only when they tell you something.
 *
 * In Common Cause every player joins `The Alliance`, so a team column on a player-only
 * roster repeats one word down the whole list. Two or more distinct teams standing is the
 * point at which allegiance starts mattering — below that the pips, the legend and the
 * meta-line entry all disappear. Fallen contestants are excluded: a wiped-out team is no
 * longer a side you are tracking.
 */
export function teamsAreRelevant(contestants: RingContestantSnapshot[]): boolean {
  const standing = new Set(
    contestants.filter((contestant) => !contestant.dead && contestant.team).map((c) => c.team),
  );
  return standing.size >= 2;
}

/**
 * Distinct teams still standing, in roster order, for the legend.
 *
 * Standing only, to match `teamsAreRelevant`: a wiped-out team is not a side you are
 * tracking, and listing its colour in a legend that claims to show "teams in play" is
 * simply wrong.
 */
export function teamsInPlay(contestants: RingContestantSnapshot[]): string[] {
  const seen: string[] = [];
  for (const { team, dead } of contestants) {
    if (team && !dead && !seen.includes(team)) seen.push(team);
  }
  return seen;
}

export type TurnPosition = 'acting' | null;

/**
 * Who is acting.
 *
 * The roster's row order *is* the order of play: `Ring.doAction` shifts contestants off
 * `this.contestants` in array order and `contestantSnapshots()` maps that same array, so
 * position in this list is position in the round. That was load-bearing information that
 * nothing else on screen carried, and it is why the roster must never be sorted or
 * grouped — an earlier design grouped rows by team and silently destroyed it.
 *
 * This deliberately does **not** predict who acts next. It used to, and the prediction
 * was wrong: the engine's queue filter is `!dead && !fled`
 * (`isActiveContestant` in `ring/index.ts`), and it further depends on the batch's card
 * index and on `emptyHanded`. `ring.state` publishes `dead` but not `fled`, so a monster
 * that has fled stays in the roster looking alive and would have been marked as up next
 * despite never acting again. Restoring the cue means publishing the real next actor from
 * the engine — a `ring.state` payload change, not something a client can infer.
 */
export function turnPositions(
  contestants: RingContestantSnapshot[],
): Map<RingContestantSnapshot, TurnPosition> {
  const positions = new Map<RingContestantSnapshot, TurnPosition>();
  for (const contestant of contestants) {
    // A fallen contestant never acts, whatever a stale payload claims.
    positions.set(contestant, contestant.acting && !contestant.dead ? 'acting' : null);
  }
  return positions;
}

/**
 * The meta line, most important first, so the least important is the first to ellipse.
 * Order comes straight from how the panel is actually read mid-fight: whose monster it
 * is, then how strong, then which side, then the number the narration already quotes on
 * every roll. Species is deliberately absent — the row's icon carries it.
 */
export function metaParts(
  contestant: RingContestantSnapshot,
  showTeam: boolean,
): Array<{ kind: 'beastmaster' | 'level' | 'team' | 'ac'; text: string }> {
  const parts: Array<{ kind: 'beastmaster' | 'level' | 'team' | 'ac'; text: string }> = [];
  // A boss has no beastmaster; the house that stages it stands in for one.
  if (contestant.isBoss) parts.push({ kind: 'beastmaster', text: '👑 The Editor' });
  else if (contestant.owner) parts.push({ kind: 'beastmaster', text: contestant.owner });
  parts.push({ kind: 'level', text: formatLevel(contestant.level) });
  if (showTeam && contestant.team) parts.push({ kind: 'team', text: contestant.team });
  parts.push({ kind: 'ac', text: `AC ${contestant.ac}` });
  return parts;
}

/**
 * Compact level display. `Lvl 3`, never `L3`, and level zero is `Beginner` rather than
 * `Lvl 0` — level zero is not a level, it is how the engine represents a monster that has
 * not earned XP yet. Both spellings are fixed by the lexicon in
 * `docs/voice-and-wording.md`; the roster previously rendered them lower-cased, off spec.
 */
export function formatLevel(level: number): string {
  return level > 0 ? `Lvl ${level}` : 'Beginner';
}

/** The whole row, spoken. Screen readers get the fields the visual row drops. */
export function describeContestant(
  contestant: RingContestantSnapshot,
  position: TurnPosition,
): string {
  const health = contestant.dead
    ? 'fallen'
    : `${contestant.hp} of ${contestant.maxHp} hit points`;
  const bits = [
    contestant.name,
    contestant.isBoss ? 'boss' : null,
    health,
    `${contestant.creatureType}, ${formatLevel(contestant.level)}`,
    contestant.isBoss ? 'staged by The Editor' : contestant.owner,
    contestant.team,
    `armor class ${contestant.ac}`,
    position === 'acting' ? 'acting now' : null,
  ];
  return bits.filter(Boolean).join(', ');
}
