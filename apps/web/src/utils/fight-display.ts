/** Shared labels for fight log / ring ticker (multi-monster aware). */

export type FightParticipantLike = {
  monsterId: string;
  monsterName: string;
  outcome: 'win' | 'loss' | 'draw' | 'fled' | 'permaDeath';
};

export type FightSummaryLike = {
  outcome: string;
  roundCount: number;
  winnerMonsterName: string | null;
  loserMonsterName: string | null;
  cardDropName: string | null;
  participants: FightParticipantLike[];
};

/** Join a list of names with natural-language "and". */
function nameList(names: string[]): string {
  if (names.length === 0) return '?';
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/**
 * One-line title: "A vs B" for 1v1, "A vs B vs C" for multi-monster.
 * Always uses the participants array when available (covers draws and multi-monster
 * fights where winnerMonsterName / loserMonsterName are null).
 */
export function fightTitleOneLine(f: FightSummaryLike): string {
  const ps = f.participants ?? [];
  if (ps.length > 0) {
    return ps.map((p) => p.monsterName).join(' vs ');
  }
  // Fallback for legacy rows that pre-date the participants column.
  return `${f.winnerMonsterName ?? '?'} vs ${f.loserMonsterName ?? '?'}`;
}

export function fightSubtitle(f: FightSummaryLike): string {
  const ps = f.participants ?? [];
  if (f.outcome === 'draw') {
    const names = ps.length > 0 ? ps.map((p) => p.monsterName) : [];
    return names.length ? `Draw — ${nameList(names)}` : 'Draw';
  }
  if (f.outcome === 'fled') {
    const fled = ps.filter((p) => p.outcome === 'fled').map((p) => p.monsterName);
    const survived = ps.filter((p) => p.outcome === 'win').map((p) => p.monsterName);
    if (fled.length && survived.length) return `${nameList(fled)} fled from ${nameList(survived)}`;
    if (fled.length) return `${nameList(fled)} fled`;
    return `${f.winnerMonsterName ?? '?'} fled`;
  }
  if (f.outcome === 'permaDeath') {
    const winners = ps.filter((p) => p.outcome === 'win').map((p) => p.monsterName);
    const dead = ps.filter((p) => p.outcome === 'permaDeath').map((p) => p.monsterName);
    const w = winners.length ? nameList(winners) : f.winnerMonsterName ?? '?';
    const d = dead.length ? nameList(dead) : f.loserMonsterName ?? '?';
    return `${w} won in ${f.roundCount} rounds — ☠ ${d} perished`;
  }
  if (f.outcome === 'win') {
    const winners = ps.filter((p) => p.outcome === 'win').map((p) => p.monsterName);
    const losers = ps.filter((p) => p.outcome === 'loss').map((p) => p.monsterName);
    const w = winners.length ? nameList(winners) : f.winnerMonsterName ?? '?';
    const l = losers.length ? nameList(losers) : f.loserMonsterName ?? '?';
    let s = `${w} won vs ${l} in ${f.roundCount} rounds`;
    if (f.cardDropName) s += ` · Card: ${f.cardDropName}`;
    return s;
  }
  let s = `Outcome: ${f.outcome}`;
  if (f.cardDropName) s += ` · Card: ${f.cardDropName}`;
  return s;
}
