import { SPRITE_ART, SPRITE_PAD, type PixelFrame } from './sprites.js';

export function clear(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

export const DEFAULT_SPRITE_FLASH = '#ffffff';

let cachedFlash: { color: string; outline: string | null } | undefined;
let flashObserver: MutationObserver | undefined;

/**
 * The active theme's hit flash, read once and cached: getComputedStyle forces a style recalc,
 * and a hit redraws every ~130 ms frame for every flashing sprite. A MutationObserver on
 * <html data-theme> drops the cache when the theme changes.
 *
 * - `--color-sprite-flash` (default white) fills the sprite's body. A light theme needs a
 *   non-white flash, because white on a white panel makes a struck monster vanish instead of
 *   blink (roadmap 46 §1).
 * - `--color-sprite-flash-outline` fills the outline pixels (palette key `O`). Its default is the
 *   flash colour, so the dark themes flash the whole silhouette as they always have; `none`
 *   keeps the outline's own dark colour, which Millefleur uses so a pale monster struck on paper
 *   still has its edge (roadmap 46 §6).
 */
function readSpriteFlash(): { color: string; outline: string | null } {
  if (typeof document === 'undefined') return { color: DEFAULT_SPRITE_FLASH, outline: DEFAULT_SPRITE_FLASH };
  if (cachedFlash === undefined) {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    const color = style.getPropertyValue('--color-sprite-flash').trim() || DEFAULT_SPRITE_FLASH;
    const outlineValue = style.getPropertyValue('--color-sprite-flash-outline').trim();
    cachedFlash = { color, outline: outlineValue === 'none' ? null : outlineValue || color };
    if (!flashObserver && typeof MutationObserver !== 'undefined') {
      flashObserver = new MutationObserver(() => { cachedFlash = undefined; });
      flashObserver.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    }
  }
  return cachedFlash;
}

export function readSpriteFlashColor(): string {
  return readSpriteFlash().color;
}

/** The outline's flash colour, or null to keep the outline's own colour while flashing. */
export function readSpriteFlashOutline(): string | null {
  return readSpriteFlash().outline;
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  spriteFrame: PixelFrame,
  palette: Readonly<Record<string, string>>,
  x: number,
  y: number,
  scale: number,
  {
    mirror,
    flash,
    flashColor = DEFAULT_SPRITE_FLASH,
    flashOutline = flashColor,
  }: { mirror: boolean; flash: boolean; flashColor?: string; flashOutline?: string | null },
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
      // A flash fills the body with the flash colour; the outline takes `flashOutline`, or keeps
      // its own colour when the theme asks for that (null), so a struck monster blinks rather
      // than disappearing into a light page.
      const flashFill = color === 'O' ? (flashOutline ?? palette[color]!) : flashColor;
      ctx.fillStyle = flash ? flashFill : palette[color]!;
      ctx.fillRect(x + (column - SPRITE_PAD) * scale, y + row * scale, scale, scale);
    }
  }
  ctx.restore();
}
