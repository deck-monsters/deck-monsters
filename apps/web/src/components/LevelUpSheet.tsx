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
  xpIntoLevel,
  xpNeededForLevel,
  nextLevel,
  nextCards,
  opener,
  onClose,
}: LevelUpSheetProps) {
  const level = nextLevel?.level;
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
        <ul className="card-detail-verdicts" aria-label="Stat gains">
          {gains.map(([key, label]) => (
            <li key={key}>
              {label} {signed(nextLevel![key])}
            </li>
          ))}
        </ul>
      )}
      {cardsNow.length > 0 ? (
        <p>New cards it can use: {joinList(cardsNow)}.</p>
      ) : nextCards && nextCards.cards.length > 0 ? (
        <p>
          No new cards at this level. Next new cards, at level {nextCards.level}:{' '}
          {joinList(nextCards.cards)}.
        </p>
      ) : nextCards === null ? (
        <p>No new cards: it can already use every card it ever will.</p>
      ) : null}
    </DetailSheet>
  );
}
