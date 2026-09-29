const HEAL_KEYWORDS = ['heal', 'scotch', 'whiskey', 'potion', 'pokecen', 'spin up', 'horn of proof', 'gloaming'];
// Unconquerable Horn has been an attack (a strike and a rally) since roadmap 35.
const MELEE_KEYWORDS = ['hit', 'berserk', 'gore', 'spear', 'knife', 'swipe', 'battle', 'rampage', 'sticketh', 'unconquerable'];
const MAGIC_KEYWORDS = ['blink', 'blast', 'mesmer', 'sandstorm', 'curse', 'coil', 'focus', 'drain', 'cloak', 'entrance', 'dissonant', 'breath', 'tsunami'];

export type CardClass = 'melee' | 'magic' | 'heal' | 'utility';

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

export function getCardClass(name: string): CardClass {
  const lower = name.toLowerCase();
  if (HEAL_KEYWORDS.some((keyword) => lower.includes(keyword))) return 'heal';
  if (MELEE_KEYWORDS.some((keyword) => lower.includes(keyword))) return 'melee';
  if (MAGIC_KEYWORDS.some((keyword) => lower.includes(keyword))) return 'magic';
  return 'utility';
}

export function getCardIcon(cardClass: CardClass): string {
  switch (cardClass) {
    case 'melee':
      return '⚔';
    case 'magic':
      return '✦';
    case 'heal':
      return '✚';
    default:
      return '◇';
  }
}

export function getCardEmoji(name: string): string {
  return getCardIcon(getCardClass(name));
}
