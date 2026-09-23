import { createContext, type ReactNode } from 'react';
import type { RingContestantSnapshot } from './RingRoster.js';

export interface RosterSpriteApi {
  /** Draws the monster's sprite for this row, or null to fall back to its icon. */
  render(contestant: RingContestantSnapshot): ReactNode;
}

/**
 * Lets the Ring roster show animated sprites without importing any of the pixel-art code.
 *
 * The art is on by default but a player can opt out, and it stays in a lazily loaded chunk
 * so that an opted-out player never fetches it and nobody's first paint waits on it. If
 * `RingRoster` imported the sprite cell directly it would pull `sprites.ts` into the main
 * bundle for every player, so the provider hands the renderer down instead. No provider
 * means rows render their plain emoji icon.
 */
export const RosterSpriteContext = createContext<RosterSpriteApi | null>(null);
