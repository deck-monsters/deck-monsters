import type { PixelFrame } from './sprites.js';

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
  if (mirror) {
    ctx.translate(x + 16 * scale, y);
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
      ctx.fillRect(x + column * scale, y + row * scale, scale, scale);
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
  const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const color = ratio >= 0.5 ? '#4ade80' : ratio >= 0.2 ? '#facc15' : '#fb7185';
  ctx.fillStyle = '#111827';
  ctx.fillRect(x, y, width, 5);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.round(width * ratio), 5);
}
