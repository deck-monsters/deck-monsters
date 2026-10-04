import { cardHoldVerdict, roleOf, type CardHoldVerdict, type CardRole } from '@deck-monsters/engine';

// A deck slot is ~70px wide at its narrowest, and its label wraps to two lines. At the
// compact size (`.workshop-card-name.compact`) a line holds about ten characters, measured
// in Chromium. The old rule kept three letters of the first three words, so "Fight or
// Flight" read "Fig or Fli" and a phone, which has no hover title, showed nothing better
// (10b #186). Now whole words are kept and only a word too long for one line is shortened.
const LONG_NAME = 12;
const MAX_WORD = 10;

/** True when a card name needs the compact label size to fit two lines. */
export function isLongCardName(name: string): boolean {
  return name.trim().replace(/\s+/g, ' ').length > LONG_NAME;
}

export function abbreviateCardName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, ' ');
  if (!normalized) return '';
  if (normalized.length <= LONG_NAME) return normalized;

  return normalized
    .split(' ')
    .map((word) => (word.length > MAX_WORD ? `${word.slice(0, 6)}.` : word))
    .join(' ');
}

/**
 * A card's display name carries its dice when the card has them ("The Kalevala (1d4)"),
 * while the engine's role table and card facts are keyed by the stable card name. Strip a
 * trailing dice suffix so both find the same card. Other names pass through unchanged.
 */
export function stableCardName(displayName: string): string {
  return displayName.replace(/\s*\(\d+d\d+\)\s*$/, '');
}

/** The slot label on a card: the five roles, short enough for a ~70px slot. */
export const CARD_ROLE_SLOT_LABEL: Record<CardRole, string> = {
  attack: 'ATTACK',
  area: 'AREA',
  heal: 'HEAL',
  guard: 'DEFENCE',
  trick: 'TRICK',
};

/**
 * The role of a card, from the engine's one role table. This replaced a name-guessing
 * keyword list that filed "Mood Scales" and "Take Wing" as utility and Blink as magic; the
 * slot now says what the card does, in the same words the guide uses. Undefined for a name
 * the table does not know (never a real card in a deck).
 */
export function getCardRole(displayName: string): CardRole | undefined {
  return roleOf(stableCardName(displayName));
}

export function getCardIcon(role: CardRole | undefined): string {
  switch (role) {
    case 'attack':
      return '⚔';
    case 'area':
      return '✸';
    case 'heal':
      return '✚';
    case 'trick':
      return '✦';
    default:
      return '◇';
  }
}

export function getCardEmoji(displayName: string): string {
  return getCardIcon(getCardRole(displayName));
}

/** The slice of the server's card facts (`game.cardFacts`) the detail sheet reads. */
export interface CardFactsView {
  name: string;
  role: CardRole;
  roleLabel: string;
  description: string;
  stats: string;
  level: number;
  usedBy: string[];
  price: number;
}

/** "A", "A and B", "A, B and C": player-facing lists use "and", no Oxford comma. */
export function joinList(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export interface VerdictMonster {
  name: string;
  type: string;
  level: number;
  monsterClass?: string;
}

/** The engine's hold rule, run in the browser against a card's facts. */
export function verdictFor(facts: CardFactsView, monster: VerdictMonster): CardHoldVerdict {
  return cardHoldVerdict(
    { level: facts.level, permittedClassesAndTypes: facts.usedBy.length > 0 ? facts.usedBy : undefined },
    { level: monster.level, class: monster.monsterClass, creatureType: monster.type },
  );
}

/** The plan's three verdict lines, for one monster. */
export function verdictLine(facts: CardFactsView, monster: VerdictMonster): string {
  const verdict = verdictFor(facts, monster);
  if (verdict.ok) return `${monster.name} can use this.`;
  if (verdict.reason === 'type') return `${monster.name} can't use this. Only ${joinList(verdict.allowed)} can.`;
  return `${monster.name} can use this from level ${verdict.level}. ${monster.name} is level ${monster.level} now.`;
}
