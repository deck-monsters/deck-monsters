export const MAX_PRESETS = 10;

/**
 * Copies of one card a monster may hold in its hand. One home for it: equip and Beastmaster
 * each kept their own copy, and the harness (which builds hands directly) needs it too, or it
 * builds hands a player never could (a Codex review of PR #405).
 */
export const MAX_CARD_COPIES_IN_HAND = 4;
