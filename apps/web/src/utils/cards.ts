const HEAL_KEYWORDS = ['heal', 'scotch', 'whiskey', 'potion', 'pokecen', 'spin up'];
const MELEE_KEYWORDS = ['hit', 'berserk', 'gore', 'spear', 'knife', 'swipe', 'battle', 'rampage'];
const MAGIC_KEYWORDS = ['blink', 'blast', 'mesmer', 'sandstorm', 'curse', 'coil', 'focus', 'drain', 'cloak', 'entrance'];

export type CardClass = 'melee' | 'magic' | 'heal' | 'utility';

export function abbreviateCardName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) return trimmed;

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return `${parts[0].slice(0, 7)}…`;
  if (parts.length === 2) {
    return `${parts[0].slice(0, 3)}${parts[1][0] ?? ''}`;
  }
  return parts
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 5);
}

export function getCardClass(name: string): CardClass {
  const lower = name.toLowerCase();
  if (HEAL_KEYWORDS.some((keyword) => lower.includes(keyword))) return 'heal';
  if (MELEE_KEYWORDS.some((keyword) => lower.includes(keyword))) return 'melee';
  if (MAGIC_KEYWORDS.some((keyword) => lower.includes(keyword))) return 'magic';
  return 'utility';
}

export function classifyCard(name: string): CardClass {
  return getCardClass(name);
}

export function getCardClassColorVar(cardClass: CardClass): string {
  switch (cardClass) {
    case 'melee':
      return '--workshop-card-melee';
    case 'magic':
      return '--workshop-card-magic';
    case 'heal':
      return '--workshop-card-heal';
    default:
      return '--color-border';
  }
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
