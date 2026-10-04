/**
 * Whether the Ring pane header shows its countdown and its summons count.
 *
 * Both are hidden while a fight is on (owner decision, roadmap 39 batch 2): the countdown
 * is about the *next* ring event and the summons count is about a summon you cannot use
 * until the ring clears, so during a fight each reads as noise beside the live roster.
 * The summons count also says what is left ("2 summons left") rather than "2/3", which
 * new players read as a fight score.
 */
export function summonsLeftLabel(remaining: number): string {
  if (remaining <= 0) return 'No summons left today';
  return remaining === 1 ? '1 summon left' : `${remaining} summons left`;
}

/**
 * The summons badge's tooltip. New-player walk 2 (#8): a player who summoned a boss then
 * saw a second one arrive on the house's own timer and read it as a miscount. The timer
 * boss does not spend a summon, so the title says so.
 */
export const SUMMONS_BADGE_TITLE =
  "Bosses you summon. The house also sends one on its own timer, which doesn't use yours.";

export function headerBadgesVisible(inEncounter: boolean | undefined): boolean {
  return !inEncounter;
}
