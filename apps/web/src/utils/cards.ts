const HEAL_KEYWORDS = ['heal', 'scotch', 'whiskey', 'potion', 'pokecen', 'spin up'];
const MELEE_KEYWORDS = ['hit', 'berserk', 'gore', 'spear', 'knife', 'swipe', 'battle', 'rampage'];
const MAGIC_KEYWORDS = ['blink', 'blast', 'mesmer', 'sandstorm', 'curse', 'coil', 'focus', 'drain', 'cloak', 'entrance'];

export type CardClass = 'melee' | 'magic' | 'heal' | 'utility';

export function abbreviateCardName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, ' ');
  if (!normalized) return '';
  if (normalized.length <= 12) return normalized;

  const parts = normalized.split(' ').filter(Boolean);
  if (parts.length === 1) return `${parts[0].slice(0, 11)}…`;
  if (parts.length === 2) return `${parts[0].slice(0, 4)} ${parts[1].slice(0, 4)}…`;

  return parts
    .slice(0, 3)
    .map((part) => part.slice(0, 3))
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
