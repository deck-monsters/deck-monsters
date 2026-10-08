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

/** At 0 HP or flagged dead. HP wins when a payload's `dead` bit is stale. */
export function isFallen(contestant: Pick<RingContestantSnapshot, 'dead' | 'hp'>): boolean {
  return contestant.dead || contestant.hp <= 0;
}

/** Left alive. A monster who also fell is fallen; that is the state the row should say. */
export function isFled(
  contestant: Pick<RingContestantSnapshot, 'dead' | 'hp' | 'fled'>,
): boolean {
  return Boolean(contestant.fled) && !isFallen(contestant);
}

/** Still in the fight: not fallen, not fled. */
export function isStanding(
  contestant: Pick<RingContestantSnapshot, 'dead' | 'hp' | 'fled'>,
): boolean {
  return !isFallen(contestant) && !isFled(contestant);
}

/**
 * Teams earn their place in a row only when they tell you something.
 *
 * In Common Cause every player joins `The Alliance`, so a team column on a player-only
 * roster repeats one word down the whole list. Two or more distinct teams standing is the
 * point at which allegiance starts mattering — below that the pips, the legend and the
 * meta-line entry all disappear. Fallen and fled contestants are excluded: a side with
 * nobody left in the fight is no longer a side you are tracking.
 */
export function teamsAreRelevant(contestants: RingContestantSnapshot[]): boolean {
  const standing = new Set(
    contestants.filter((contestant) => isStanding(contestant) && contestant.team).map((c) => c.team),
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
  for (const contestant of contestants) {
    const { team } = contestant;
    if (team && isStanding(contestant) && !seen.includes(team)) seen.push(team);
  }
  return seen;
}

/**
 * "2 standing · 1 fallen · 1 fled". Someone who fled used to be counted as standing,
 * because the snapshot had no `fled` bit, so the header and the row both sat still.
 */
export function rosterStatus(contestants: RingContestantSnapshot[]): string {
  let fallen = 0;
  let fled = 0;
  for (const contestant of contestants) {
    if (isFallen(contestant)) fallen += 1;
    else if (isFled(contestant)) fled += 1;
  }
  const standing = contestants.length - fallen - fled;
  const parts = [`${standing} standing`];
  if (fallen > 0) parts.push(`${fallen} fallen`);
  if (fled > 0) parts.push(`${fled} fled`);
  return parts.join(' · ');
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
 * index and on `emptyHanded`. `ring.state` now publishes `fled`, but not an empty hand,
 * so a client still cannot know who is up next. That cue has to come from the engine.
 */
export function turnPositions(
  contestants: RingContestantSnapshot[],
): Map<RingContestantSnapshot, TurnPosition> {
  const positions = new Map<RingContestantSnapshot, TurnPosition>();
  for (const contestant of contestants) {
    // A fallen or fled contestant never acts, whatever a stale payload claims. The
    // actor flag stays on them until the next turn's publish.
    positions.set(contestant, contestant.acting && isStanding(contestant) ? 'acting' : null);
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
 * `docs/reference/voice-and-wording.md`; the roster previously rendered them lower-cased,
 * off spec.
 */
export function formatLevel(level: number): string {
  return level > 0 ? `Lvl ${level}` : 'Beginner';
}

/** The whole row, spoken. Screen readers get the fields the visual row drops. */
export function describeContestant(
  contestant: RingContestantSnapshot,
  position: TurnPosition,
): string {
  const health = isFallen(contestant)
    ? 'fallen'
    : isFled(contestant)
      ? 'fled'
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
