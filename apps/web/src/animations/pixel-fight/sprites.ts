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

const serpent: PixelFrame = ['................','......OOOO......','.....OAAAO......','...OOABBAOO.....','..OABBBCAAAO....','..OABBBBAAAAO...','...OABBBBBAAO...','....OABBBBBAO...','.....OABBBBBAO..','...OOABBBBBAAO..','..OABBBBBAAAO...','.OABBBBAAAAO....','.OABBAAAO.......','..OAAAAO........','...OOOO.........','................'];
const warrior: PixelFrame = ['................','......OOOO......','.....OCAACO.....','.....OABBAO.....','....OOABBBO.....','...OABBBBBAO....','...OABCCCBAOO...','...OABBBBBAAOC..','...OABBBBBAAO...','....OABBBAO.....','....OABBAAO.....','....OABBAO......','...OAAOBAAO.....','...OOO.OOO......','................','................'];
const smoke: PixelFrame = ['................','.......OO.......','......OCCO......','.....OABBAO.....','....OABBBBAO....','...OABCCCBAO....','..OABBBBBBBAO...','...OABBBBBAO....','....OABBBAO.....','.....OABO.......','....OABBAO......','...OABBBAAO.....','....OABBAO......','.....OAAO.......','......OO........','................'];
const bull: PixelFrame = ['................','...OO......OO...','..OCCO....OCCO..','...OABOOOOBAO...','....OABBBBAO....','...OABCCCBAO....','..OABBBBBBBAO...','..OABBBBBBBAO...','..OABBBBBBBAO...','...OABBABBAO....','...OABBABBAO....','..OAAO..OAAO....','..OAAO..OAAO....','...OO....OO.....','................','................'];
const angel: PixelFrame = ['................','.......OO.......','......OCCO......','......OAAO......','..OOOABBAOOO....','.OABBBBBBBBAO...','OABBBCCCCCBBBAO.','OABBBBBBBBBBBAO.','.OABBBBAABBBAO..','..OABBBAABBAO...','...OABBBBBAO....','...OABBBBBAO....','....OABBAO......','....OAAAAO......','.....OOOO.......','................'];
const beast: PixelFrame = ['................','.....OOOO.......','....OCAACO......','...OABBBBAO.....','..OABBBBBBAO....','..OABCCCBBBAO...','..OABBBBBBBAO...','...OABBBBBAO....','...OABBBBBAO....','..OABBAABBAO....','..OABBAABBAO....','.OAAO....OAAO...','.OAAO....OAAO...','..OO......OO....','................','................'];

const SIZE = 16;
const EMPTY_ROW = '.'.repeat(SIZE);

/** Translate a frame by whole pixels; anything pushed past the edge is dropped. */
function shift(frame: PixelFrame, dx: number, dy: number): PixelFrame {
  return Array.from({ length: SIZE }, (_, y) => {
    const source = frame[y - dy];
    if (source === undefined) return EMPTY_ROW;
    const row = dx >= 0 ? '.'.repeat(dx) + source.slice(0, SIZE - dx) : source.slice(-dx) + '.'.repeat(-dx);
    return row;
  });
}

/** Turn the standing pose on its side (90° clockwise) — the fallen pose. */
function lieDown(frame: PixelFrame): PixelFrame {
  return Array.from({ length: SIZE }, (_, y) =>
    Array.from({ length: SIZE }, (_, x) => frame[SIZE - 1 - x]![y]!).join(''),
  );
}

// One hand-drawn literal map per monster is the reviewable artifact; the poses are
// pure transforms of it so a silhouette change never has to be redrawn six times.
// Sprites face right; the renderer mirrors for the right-hand side and applies the
// hit flash, so `hit` is just the standing frame.
function poses(base: PixelFrame): PixelSprite['frames'] {
  return {
    idle: [base, shift(base, 0, -1)],
    attack: [shift(base, 1, 0), shift(base, 2, 1)],
    hit: [base],
    faint: [lieDown(base)],
  };
}

export const SPRITES: Readonly<Record<string, PixelSprite>> = {
  Basilisk: { palette: { O: '#064e3b', A: '#6ee7b7', B: '#208060', C: '#d1fae5' }, frames: poses(serpent) },
  Gladiator: { palette: { O: '#713f12', A: '#facc15', B: '#ca8a04', C: '#fb7185' }, frames: poses(warrior) },
  Jinn: { palette: { O: '#164e63', A: '#67e8f9', B: '#0e7490', C: '#cffafe' }, frames: poses(smoke) },
  Minotaur: { palette: { O: '#7c2d12', A: '#f97316', B: '#9a3412', C: '#fde68a' }, frames: poses(bull) },
  'Weeping Angel': { palette: { O: '#4c1d95', A: '#c4b5fd', B: '#7c3aed', C: '#ede9fe' }, frames: poses(angel) },
  fallback: { palette: { O: '#1e293b', A: '#94a3b8', B: '#475569', C: '#e2e8f0' }, frames: poses(beast) },
};

export function spriteFor(creatureType: string): PixelSprite {
  return SPRITES[creatureType] ?? SPRITES.fallback;
}
