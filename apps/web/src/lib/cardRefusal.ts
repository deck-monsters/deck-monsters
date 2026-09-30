import { MAX_CARD_COPIES_IN_HAND } from '@deck-monsters/engine';

/**
 * Why a card cannot go on a monster. The first four are the codes the engine's
 * `equipCards` returns for a skipped card (`EquipSkipReason`); `fighting` is known
 * client-side from the monster's `inEncounter` flag.
 *
 * Roadmap 39 batch 2 / help-inventory #10: a refused move said only "Cannot use selected
 * inventory card." with no reason.
 */
export type CardRefusalReason =
  | 'cannot_hold'
  | 'deck_full'
  | 'max_copies'
  | 'not_in_inventory'
  | 'fighting';

/**
 * The reason sentences. Every one is a placeholder: the owner writes the final wording.
 * Each ends without a full stop; `cardRefusalSentence` adds it.
 */
export const CARD_REFUSAL_REASON_TEXT: Record<CardRefusalReason, string> = {
  // DRAFT(39): cannot_hold - this kind of monster cannot hold this card (class restriction)
  cannot_hold: 'DRAFT(39) cannot_hold',
  // DRAFT(39): deck_full - every card slot on the monster is taken
  deck_full: 'DRAFT(39) deck_full',
  // DRAFT(39): max_copies - the monster already holds the most copies of this card allowed
  max_copies: 'DRAFT(39) max_copies',
  // DRAFT(39): not_in_inventory - no copy of the card is left in the inventory
  not_in_inventory: 'DRAFT(39) not_in_inventory',
  // DRAFT(39): fighting - the monster is in a fight, so its cards are locked
  fighting: 'DRAFT(39) fighting',
};

export const isCardRefusalReason = (value: string): value is CardRefusalReason =>
  Object.prototype.hasOwnProperty.call(CARD_REFUSAL_REASON_TEXT, value);

/** `{Card} can't go on {Monster}: {reason}.` */
export function cardRefusalSentence(cardName: string, monsterName: string, reason: string): string {
  const text = isCardRefusalReason(reason) ? CARD_REFUSAL_REASON_TEXT[reason] : CARD_REFUSAL_REASON_TEXT.cannot_hold;
  return `${cardName} can't go on ${monsterName}: ${text}.`;
}

/**
 * The first reason a card cannot be added to this monster right now, or null when it can.
 * Mirrors the order `Beastmaster.equipCards` checks in, so the hint shown before a tap
 * agrees with the refusal after it.
 */
export function cardRefusalReason(params: {
  cardName: string;
  monster: { cards: string[]; cardSlots: number; inEncounter?: boolean };
  compatible: boolean;
}): CardRefusalReason | null {
  const { cardName, monster, compatible } = params;
  if (monster.inEncounter) return 'fighting';
  if (!compatible) return 'cannot_hold';
  if (monster.cards.length >= monster.cardSlots) return 'deck_full';
  const copies = monster.cards.filter((name) => name === cardName).length;
  if (copies >= MAX_CARD_COPIES_IN_HAND) return 'max_copies';
  return null;
}

/** The Workshop's line after an equip: what went on, what did not and why, and the deck count. */
export function equipResultMessage(params: {
  monsterName: string;
  cardNames: string[];
  result: {
    skippedCards: string[];
    skipped?: Array<{ cardName: string; reason: string }>;
    cardCount?: number | null;
    cardSlots?: number | null;
  };
}): string {
  const { monsterName, cardNames, result } = params;
  const skipped = result.skipped ?? result.skippedCards.map((cardName) => ({ cardName, reason: 'cannot_hold' }));
  // Skipped entries are per requested card, so remove one requested name per skip.
  const remaining = [...cardNames];
  for (const { cardName } of skipped) {
    const at = remaining.indexOf(cardName);
    if (at >= 0) remaining.splice(at, 1);
  }
  const parts: string[] = [];
  if (remaining.length > 0) {
    const counts = new Map<string, number>();
    remaining.forEach((name) => counts.set(name, (counts.get(name) ?? 0) + 1));
    const list = [...counts].map(([name, n]) => (n > 1 ? `${name} x${n}` : name)).join(', ');
    parts.push(`Equipped ${list} on ${monsterName}.`);
    if (typeof result.cardCount === 'number' && typeof result.cardSlots === 'number') {
      parts.push(`${monsterName} holds ${result.cardCount} of ${result.cardSlots} cards.`);
    }
  }
  for (const { cardName, reason } of skipped) parts.push(cardRefusalSentence(cardName, monsterName, reason));
  return parts.join(' ');
}
