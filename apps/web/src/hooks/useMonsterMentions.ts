import { useMemo } from 'react';
import type { MonsterMentions } from '../utils/format-event-text.js';
import { buildMentionIndex } from '../utils/monster-mentions.js';
import { useKnownMonsters } from './useKnownMonsters.js';
import { loadInlineSprites, useInlineSprites } from './useInlineSprites.js';
import { usePixelMonsters } from './usePixelMonsters.js';

/**
 * What a pane passes to `formatEventText` to draw sprites in place of known monsters' emoji,
 * or null — pixel monsters off, the sprite chunk not loaded yet, or no monsters seen — in
 * which case text renders exactly as it always has.
 *
 * The matcher is rebuilt only when the room's set of known monsters changes, not on every
 * `ring.state` tick (see `useKnownMonsters`).
 */
export function useMonsterMentions(
  roomId: string,
  loader: typeof loadInlineSprites = loadInlineSprites,
): MonsterMentions | null {
  const { pixelMonstersEnabled } = usePixelMonsters();
  const known = useKnownMonsters(roomId);
  const render = useInlineSprites(pixelMonstersEnabled, loader);
  return useMemo(
    () =>
      render && known.monsters.length > 0
        ? { index: buildMentionIndex(known.monsters, known.beastmasterNames), render }
        : null,
    [render, known],
  );
}
