export type PixelFrame = readonly string[];

export interface PixelSprite {
  palette: Readonly<Record<string, string>>;
  frames: {
    idle: readonly [PixelFrame, PixelFrame];
    attack: readonly [PixelFrame, PixelFrame];
    hit: readonly [PixelFrame];
    faint: readonly [PixelFrame];
  };
}

type Pixel = readonly [x: number, y: number, color: string];

function frame(pixels: readonly Pixel[]): PixelFrame {
  const rows = Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => '.'));
  for (const [x, y, color] of pixels) rows[y]![x] = color;
  return rows.map((row) => row.join(''));
}

function move(pixels: readonly Pixel[], dx: number, dy: number): Pixel[] {
  return pixels
    .map(([x, y, color]) => [x + dx, y + dy, color] as const)
    .filter(([x, y]) => x >= 0 && x < 16 && y >= 0 && y < 16);
}

function flatten(pixels: readonly Pixel[]): Pixel[] {
  return pixels.map(([x, y, color]) => [x, Math.min(14, 9 + Math.floor((y - 4) / 2)), color] as const);
}

function sprite(palette: PixelSprite['palette'], pixels: readonly Pixel[]): PixelSprite {
  return {
    palette,
    frames: {
      idle: [frame(pixels), frame(move(pixels, 0, -1))],
      attack: [frame(move(pixels, 1, 0)), frame(move(pixels, 2, -1))],
      hit: [frame(pixels)],
      faint: [frame(flatten(pixels))],
    },
  };
}

const basilisk: Pixel[] = [
  [3, 9, 'A'], [4, 8, 'A'], [4, 9, 'B'], [5, 7, 'A'], [5, 8, 'B'], [5, 9, 'A'],
  [6, 6, 'A'], [6, 7, 'B'], [6, 8, 'A'], [6, 9, 'B'], [7, 6, 'B'], [7, 7, 'C'],
  [7, 8, 'A'], [7, 9, 'B'], [8, 7, 'A'], [8, 8, 'B'], [8, 9, 'A'], [9, 8, 'A'],
  [9, 9, 'B'], [10, 9, 'A'], [11, 10, 'A'], [12, 10, 'B'], [13, 11, 'A'],
];

const gladiator: Pixel[] = [
  [7, 3, 'A'], [8, 3, 'A'], [6, 4, 'A'], [7, 4, 'B'], [8, 4, 'B'], [9, 4, 'A'],
  [7, 5, 'C'], [8, 5, 'C'], [6, 6, 'A'], [7, 6, 'B'], [8, 6, 'B'], [9, 6, 'A'],
  [5, 7, 'C'], [6, 7, 'C'], [7, 7, 'B'], [8, 7, 'B'], [9, 7, 'A'], [10, 7, 'D'],
  [7, 8, 'B'], [8, 8, 'B'], [7, 9, 'A'], [8, 9, 'A'], [6, 10, 'C'], [9, 10, 'C'],
  [6, 11, 'C'], [9, 11, 'C'], [5, 12, 'D'], [10, 12, 'D'],
];

const jinn: Pixel[] = [
  [7, 2, 'A'], [8, 2, 'A'], [6, 3, 'A'], [7, 3, 'B'], [8, 3, 'B'], [9, 3, 'A'],
  [6, 4, 'C'], [7, 4, 'A'], [8, 4, 'A'], [9, 4, 'C'], [5, 5, 'A'], [6, 5, 'B'],
  [7, 5, 'C'], [8, 5, 'C'], [9, 5, 'B'], [10, 5, 'A'], [6, 6, 'A'], [7, 6, 'B'],
  [8, 6, 'B'], [9, 6, 'A'], [6, 7, 'B'], [7, 7, 'A'], [8, 7, 'A'], [9, 7, 'B'],
  [7, 8, 'C'], [8, 8, 'C'], [6, 9, 'A'], [7, 9, 'B'], [8, 9, 'B'], [9, 9, 'A'],
  [5, 10, 'C'], [6, 10, 'A'], [7, 10, 'B'], [8, 10, 'B'], [9, 10, 'A'], [10, 10, 'C'],
  [7, 11, 'A'], [8, 11, 'A'], [6, 12, 'C'], [9, 12, 'C'],
];

const minotaur: Pixel[] = [
  [4, 3, 'C'], [5, 3, 'C'], [10, 3, 'C'], [11, 3, 'C'], [5, 4, 'A'], [6, 4, 'A'],
  [7, 4, 'B'], [8, 4, 'B'], [9, 4, 'A'], [10, 4, 'A'], [6, 5, 'A'], [7, 5, 'B'],
  [8, 5, 'B'], [9, 5, 'A'], [6, 6, 'D'], [9, 6, 'D'], [6, 7, 'A'], [7, 7, 'B'],
  [8, 7, 'B'], [9, 7, 'A'], [5, 8, 'A'], [6, 8, 'B'], [7, 8, 'B'], [8, 8, 'B'],
  [9, 8, 'B'], [10, 8, 'A'], [6, 9, 'A'], [7, 9, 'B'], [8, 9, 'B'], [9, 9, 'A'],
  [5, 10, 'A'], [6, 10, 'B'], [9, 10, 'B'], [10, 10, 'A'], [5, 11, 'A'], [10, 11, 'A'],
  [5, 12, 'C'], [10, 12, 'C'], [4, 13, 'C'], [11, 13, 'C'],
];

const angel: Pixel[] = [
  [7, 2, 'D'], [8, 2, 'D'], [6, 3, 'A'], [7, 3, 'B'], [8, 3, 'B'], [9, 3, 'A'],
  [7, 4, 'C'], [8, 4, 'C'], [5, 5, 'A'], [6, 5, 'A'], [7, 5, 'B'], [8, 5, 'B'],
  [9, 5, 'A'], [10, 5, 'A'], [3, 6, 'C'], [4, 6, 'C'], [5, 6, 'A'], [6, 6, 'B'],
  [7, 6, 'B'], [8, 6, 'B'], [9, 6, 'B'], [10, 6, 'A'], [11, 6, 'C'], [12, 6, 'C'],
  [4, 7, 'A'], [5, 7, 'B'], [6, 7, 'B'], [7, 7, 'C'], [8, 7, 'C'], [9, 7, 'B'],
  [10, 7, 'B'], [11, 7, 'A'], [6, 8, 'B'], [7, 8, 'A'], [8, 8, 'A'], [9, 8, 'B'],
  [6, 9, 'A'], [7, 9, 'B'], [8, 9, 'B'], [9, 9, 'A'], [5, 10, 'C'], [6, 10, 'A'],
  [7, 10, 'B'], [8, 10, 'B'], [9, 10, 'A'], [10, 10, 'C'], [6, 11, 'A'], [9, 11, 'A'],
  [6, 12, 'C'], [9, 12, 'C'],
];

const fallback: Pixel[] = [
  [7, 3, 'A'], [8, 3, 'A'], [6, 4, 'A'], [7, 4, 'B'], [8, 4, 'B'], [9, 4, 'A'],
  [6, 5, 'A'], [7, 5, 'B'], [8, 5, 'B'], [9, 5, 'A'], [5, 6, 'A'], [6, 6, 'B'],
  [7, 6, 'B'], [8, 6, 'B'], [9, 6, 'B'], [10, 6, 'A'], [6, 7, 'A'], [7, 7, 'B'],
  [8, 7, 'B'], [9, 7, 'A'], [6, 8, 'A'], [7, 8, 'B'], [8, 8, 'B'], [9, 8, 'A'],
  [6, 9, 'A'], [7, 9, 'A'], [8, 9, 'A'], [9, 9, 'A'], [5, 10, 'A'], [6, 10, 'A'],
  [9, 10, 'A'], [10, 10, 'A'], [5, 11, 'A'], [10, 11, 'A'], [5, 12, 'A'], [10, 12, 'A'],
];

export const SPRITES: Readonly<Record<string, PixelSprite>> = {
  Basilisk: sprite({ A: '#6ee7b7', B: '#208060', C: '#d1fae5' }, basilisk),
  Gladiator: sprite({ A: '#facc15', B: '#ca8a04', C: '#fb7185', D: '#e5e7eb' }, gladiator),
  Jinn: sprite({ A: '#67e8f9', B: '#0e7490', C: '#cffafe' }, jinn),
  Minotaur: sprite({ A: '#f97316', B: '#9a3412', C: '#fde68a', D: '#fff7ed' }, minotaur),
  'Weeping Angel': sprite({ A: '#c4b5fd', B: '#7c3aed', C: '#ede9fe', D: '#fefce8' }, angel),
  fallback: sprite({ A: '#94a3b8', B: '#475569' }, fallback),
};

export function spriteFor(creatureType: string): PixelSprite {
  return SPRITES[creatureType] ?? SPRITES.fallback;
}
