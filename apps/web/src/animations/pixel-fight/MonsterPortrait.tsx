import { useEffect, useRef } from 'react';
import { clear, drawSprite } from './renderer.js';
import { SPRITE_ART, spriteFor } from './sprites.js';
import { paletteFor } from './appearance-palette.js';

/** Integer scale: 2x the roster's 24px art box, so a pixel stays a whole number of pixels. */
const SCALE = 2;
export const PORTRAIT_PX = SPRITE_ART * SCALE;

/**
 * A monster's still, larger portrait for the Workshop panel (the Ring roster's sprite at 2x).
 *
 * Static, unlike the roster's: the Workshop is a place to read and arrange cards, so nothing
 * here should breathe. It reuses the roster's renderer, sprite table and palette (so the
 * colours match the monster's roster sprite), and lives in the same lazy chunk family: the
 * caller loads it with `lazy()` only when pixel monsters are on.
 */
export default function MonsterPortrait({
  creatureType,
  appearance,
  name,
}: {
  creatureType: string;
  appearance?: string;
  name: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(PORTRAIT_PX * pixelRatio);
    canvas.height = Math.round(PORTRAIT_PX * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const sprite = spriteFor(creatureType);
    clear(ctx);
    drawSprite(ctx, sprite.frames.idle[0]!, paletteFor(sprite.palette, appearance, name, null), 0, 0, SCALE, {
      mirror: false,
      flash: false,
    });
  }, [creatureType, appearance, name]);

  return (
    <canvas
      ref={canvasRef}
      className="roster-sprite monster-portrait-sprite"
      style={{ width: PORTRAIT_PX, height: PORTRAIT_PX }}
      aria-hidden="true"
    />
  );
}
