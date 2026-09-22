import { useEffect, useState } from 'react';
import type { KnownMonster } from '../utils/monster-mentions.js';
import type { ReactNode } from 'react';

type RenderInlineSprite = (monster: KnownMonster, key: string) => ReactNode;

/** The sprite chunk is shared with the roster's sprites, so this is usually already loaded. */
export const loadInlineSprites = () => import('../animations/pixel-fight/inline-sprite.js');

/**
 * The feed's sprite renderer, loaded only when pixel monsters are on.
 *
 * Deliberately not `React.lazy` + `Suspense`, which the roster uses: the feed is a
 * virtualised list, and a Suspense boundary would mount it once in the fallback and again
 * when the chunk arrived, losing the reader's scroll position. Here the feed renders plain
 * emoji until the renderer lands, then re-renders the visible lines in place.
 */
export function useInlineSprites(
  enabled: boolean,
  loader: () => Promise<{ renderInlineSprite: RenderInlineSprite }> = loadInlineSprites,
): RenderInlineSprite | null {
  const [render, setRender] = useState<RenderInlineSprite | null>(null);

  useEffect(() => {
    if (!enabled) {
      setRender(null);
      return;
    }
    let cancelled = false;
    loader()
      .then((module) => {
        // A function in state has to be wrapped, or React calls it as an updater.
        if (!cancelled) setRender(() => module.renderInlineSprite);
      })
      .catch(() => {
        // A failed chunk load leaves the emoji in place; nothing to tell the player.
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, loader]);

  return enabled ? render : null;
}
