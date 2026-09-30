/**
 * The one-line description of each place in the workspace (roadmap 39 batch 3).
 *
 * Kept apart from `surfaces.ts` because that file imports every panel, and the panels need
 * these lines for their subtitles: importing the registry from a panel would be a cycle.
 * `surfaces.ts` reads this table for each `SurfaceDefinition.description` and re-exports
 * `surfaceDescription`, so the tab title and the panel subtitle are the same text.
 */
export type DescribedSurfaceId = 'ring' | 'console' | 'workshop' | 'fights' | 'leaderboard';

export const SURFACE_DESCRIPTIONS: Record<DescribedSurfaceId, string> = {
  ring: 'Watch the fight as it happens: who is in, whose turn it is, and every card played.',
  console: "Type commands and answer the game's questions. Type help to see them all.",
  workshop: 'Train monsters, choose their cards, and spend your coins.',
  fights: 'Every fight in this room, with its play-by-play.',
  leaderboard: 'Who is winning, in this room and across every room.',
};

export function surfaceDescription(id: DescribedSurfaceId): string {
  return SURFACE_DESCRIPTIONS[id];
}
