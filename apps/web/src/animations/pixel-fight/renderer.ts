import { SPRITE_ART, SPRITE_PAD, type PixelFrame } from './sprites.js';

export function clear(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

export const DEFAULT_SPRITE_FLASH = '#ffffff';

let cachedFlashColor: string | undefined;
let flashObserver: MutationObserver | undefined;

/**
 * The hit-flash colour for the active theme (`--color-sprite-flash`, default white).
 * Read once and cached: getComputedStyle forces a style recalc, and a hit redraws every
 * ~130 ms frame for every flashing sprite. A MutationObserver on <html data-theme> drops
 * the cache when the theme changes. A light theme needs a non-white flash, because white
 * on a white panel makes a struck monster vanish instead of blink (roadmap 46 §1).
 */
export function readSpriteFlashColor(): string {
  if (typeof document === 'undefined') return DEFAULT_SPRITE_FLASH;
  if (cachedFlashColor === undefined) {
    const root = document.documentElement;
    cachedFlashColor =
      getComputedStyle(root).getPropertyValue('--color-sprite-flash').trim() || DEFAULT_SPRITE_FLASH;
    if (!flashObserver && typeof MutationObserver !== 'undefined') {
      flashObserver = new MutationObserver(() => { cachedFlashColor = undefined; });
      flashObserver.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    }
  }
  return cachedFlashColor;
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  spriteFrame: PixelFrame,
  palette: Readonly<Record<string, string>>,
  x: number,
  y: number,
  scale: number,
  { mirror, flash, flashColor = DEFAULT_SPRITE_FLASH }: { mirror: boolean; flash: boolean; flashColor?: string },
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  // `x` is the left edge of the 24px art box, not of the wider pose grid the frame is
  // drawn on, so a lean that swings past the art does not shove the fighter sideways.
  // Mirroring reflects about that same box, keeping left- and right-hand fighters on
  // matching marks.
  if (mirror) {
    ctx.translate(x + SPRITE_ART * scale, y);
    ctx.scale(-1, 1);
    x = 0;
    y = 0;
  }

  for (let row = 0; row < spriteFrame.length; row += 1) {
    const pixels = spriteFrame[row]!;
    for (let column = 0; column < pixels.length; column += 1) {
      const color = pixels[column]!;
      if (color === '.') continue;
      // TODO(roadmap 46 task 5): today the flash covers the outline (key 'O') too, so the
      // whole sprite is one flat colour. A light theme wants the outline kept dark so a
      // struck monster blinks rather than disappears; changing it here would alter every
      // theme, so it waits for that task.
      ctx.fillStyle = flash ? flashColor : palette[color]!;
      ctx.fillRect(x + (column - SPRITE_PAD) * scale, y + row * scale, scale, scale);
    }
  }
  ctx.restore();
}
