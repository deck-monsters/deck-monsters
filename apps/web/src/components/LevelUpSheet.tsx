import DetailSheet from './DetailSheet.js';
import { joinList } from '../utils/cards.js';

export interface LevelUpGainsView {
  level: number;
  hp: number;
  ac: number;
  str: number;
  dex: number;
  int: number;
}

interface LevelUpSheetProps {
  monsterName: string;
  /** Subject pronoun ("she", "they"); the name stands in when it is missing. */
  pronoun?: string;
  xpIntoLevel: number;
  xpNeededForLevel: number;
  /** What the next level changes; missing from older payloads, which then show no stat list. */
  nextLevel?: LevelUpGainsView;
  /** The next level that opens cards, and which (see `InventoryMonsterSummary.nextCards`). */
  nextCards?: { level: number; cards: string[] } | null;
  opener?: HTMLElement | null;
  onClose: () => void;
}

const STAT_LABELS: Array<[keyof Omit<LevelUpGainsView, 'level'>, string]> = [
  ['hp', 'Max HP'],
  ['ac', 'AC'],
  ['str', 'STR'],
  ['dex', 'DEX'],
  ['int', 'INT'],
];

const signed = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);

/**
 * What the next level brings a monster, opened from its XP bar (bug 225). It replaced the
 * panel's "At level 3: Pound and Vengeful Rampage." line, which named cards with no context
 * (the owner found it confusing): here they sit with the stat gains and the XP still to go.
 */
export default function LevelUpSheet({
  monsterName,
  pronoun,
  xpIntoLevel,
  xpNeededForLevel,
  nextLevel,
  nextCards,
  opener,
  onClose,
}: LevelUpSheetProps) {
  const level = nextLevel?.level;
  // "it" read as an object, not a companion (bug 230): the monster's own pronoun, or its name.
  const who = pronoun || monsterName;
  const toGo = Math.max(0, xpNeededForLevel - xpIntoLevel);
  // Only changes: a stat at its cap gains nothing and is left out rather than shown as +0.
  const gains = nextLevel ? STAT_LABELS.filter(([key]) => nextLevel[key] !== 0) : [];
  const cardsNow = nextCards && level !== undefined && nextCards.level === level ? nextCards.cards : [];

  return (
    <DetailSheet
      title={level !== undefined ? `${monsterName} at level ${level}` : `${monsterName}'s next level`}
      titleId="level-up-title"
      closeTitle="Close the level details"
      opener={opener}
      onClose={onClose}
    >
      <p>
        {toGo} more XP to go ({xpIntoLevel} of {xpNeededForLevel}). Monsters earn XP in the ring,
        most of it from wins.
      </p>
      {gains.length > 0 && (
        <ul className="card-detail-verdicts level-up-gains" aria-label="Stat gains">
          {gains.map(([key, label]) => (
            // Two spans so Millefleur can draw a tile (gain over label). Everywhere else they
            // read as one line, "Max HP +3", exactly as before.
            <li key={key}>
              <span className="level-up-stat">{label}</span> <span className="level-up-gain">{signed(nextLevel![key])}</span>
            </li>
          ))}
        </ul>
      )}
      {cardsNow.length > 0 ? (
        <p>New cards {who} can use: {joinList(cardsNow)}.</p>
      ) : nextCards && nextCards.cards.length > 0 ? (
        <p>
          No new cards at this level. Next new cards, at level {nextCards.level}:{' '}
          {joinList(nextCards.cards)}.
        </p>
      ) : nextCards === null ? (
        <p>No new cards to come: {who} can already use all of them.</p>
      ) : null}
    </DetailSheet>
  );
}
