import type { ReactNode } from 'react';
import type { KnownMonster } from '../../utils/monster-mentions.js';
import { paletteFor } from './appearance-palette.js';
import { SPRITE_ART, SPRITE_PAD, spriteFor } from './sprites.js';

/**
 * A monster's still portrait for the feed, in place of its emoji (roadmap 24).
 *
 * Static on purpose: a screen of narration names a monster on most lines, and a feed full of
 * breathing sprites is exactly the distraction that got the first version switched off
 * (#166). The roster keeps the motion.
 *
 * Drawn once per monster to a 24×24 PNG at one device pixel per art pixel, then shown at
 * 16 CSS px with `image-rendering: pixelated` (see `.inline-sprite`). 16px is the emoji's
 * own footprint at the feed's 14px text, and rendered in Chromium it left every line box
 * exactly as tall as the emoji did at 1×, 2× and 3× — the ask was "without disrupting text
 * layout". The trade: only at 3× (iPhone) is that a whole number of device pixels per art
 * pixel. At 2× (iPad) it is 1.33, and at 1× the art is shrunk; both were checked and still
 * read clearly. The crisp alternatives were worse — 12px at 2× is smaller than the emoji,
 * 24px is taller than the line and changed where lines wrapped.
 */
const urls = new Map<string, string | null>();
const URL_CACHE_LIMIT = 500;

function portraitUrl(monster: KnownMonster): string | null {
  const key = JSON.stringify([monster.creatureType, monster.appearance ?? '', monster.name, monster.appearanceHex ?? '']);
  const cached = urls.get(key);
  if (cached !== undefined) return cached;

  const sprite = spriteFor(monster.creatureType);
  const palette = paletteFor(sprite.palette, monster.appearance, monster.name, monster.appearanceHex);
  let url: string | null = null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = SPRITE_ART;
    canvas.height = SPRITE_ART;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      sprite.frames.idle[0].forEach((row, y) => {
        for (let x = 0; x < row.length; x += 1) {
          const key = row[x]!;
          if (key === '.') continue;
          ctx.fillStyle = palette[key]!;
          // The pose grid is padded for leans; the art box starts SPRITE_PAD in.
          ctx.fillRect(x - SPRITE_PAD, y, 1, 1);
        }
      });
      url = canvas.toDataURL('image/png');
    }
  } catch {
    // No canvas (an old browser, a test environment): the emoji stays.
    url = null;
  }

  if (urls.size >= URL_CACHE_LIMIT) urls.clear();
  urls.set(key, url);
  return url;
}

export function renderInlineSprite(monster: KnownMonster, key: string): ReactNode {
  const url = portraitUrl(monster);
  if (!url) return monster.icon;
  // `alt` is the emoji it replaces, so a screen reader announces what it always did and a
  // failed image degrades to exactly today's text.
  return (
    <img
      key={key}
      className="inline-sprite"
      src={url}
      alt={monster.icon}
      width={16}
      height={16}
      draggable={false}
    />
  );
}
