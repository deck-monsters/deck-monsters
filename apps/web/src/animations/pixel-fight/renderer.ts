import { SPRITE_ART, SPRITE_PAD, type PixelFrame } from './sprites.js';
import { hpBand, hpRatio } from '../../components/RingRoster.js';

const HP_BAND_COLORS = {
  healthy: '#4ade80',
  hurt: '#facc15',
  critical: '#fb7185',
} as const;

export function clear(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  spriteFrame: PixelFrame,
  palette: Readonly<Record<string, string>>,
  x: number,
  y: number,
  scale: number,
  { mirror, flash }: { mirror: boolean; flash: boolean },
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
      ctx.fillStyle = flash ? '#ffffff' : palette[color]!;
      ctx.fillRect(x + (column - SPRITE_PAD) * scale, y + row * scale, scale, scale);
    }
  }
  ctx.restore();
}

export function drawHpBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  hp: number,
  maxHp: number,
): void {
  const ratio = hpRatio(hp, maxHp);
  const color = HP_BAND_COLORS[hpBand(ratio)];
  ctx.fillStyle = '#111827';
  ctx.fillRect(x, y, width, 5);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.round(width * ratio), 5);
}
