import { createContext, type ReactNode } from 'react';
import type { RingContestantSnapshot } from './RingRoster.js';

export interface RosterSpriteApi {
  /** Draws the monster's sprite for this row, or null to fall back to its icon. */
  render(contestant: RingContestantSnapshot): ReactNode;
}

/**
 * Lets the Ring roster show animated sprites without importing any of the pixel-art code.
 *
 * The art is gated on a theme feature *and* a player opt-in, and must stay in a lazily
 * loaded chunk that is never fetched for anyone else. If `RingRoster` imported the sprite
 * cell directly it would pull `sprites.ts` into the main bundle for every player, so the
 * provider hands the renderer down instead. No provider — the default — means rows render
 * their plain icon exactly as before.
 */
export const RosterSpriteContext = createContext<RosterSpriteApi | null>(null);
