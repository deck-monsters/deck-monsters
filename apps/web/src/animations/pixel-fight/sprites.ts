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

// Every animation keeps a literal 16×16 map: the duplicated-looking idle/hit maps are
// deliberate reviewable poses, while the renderer supplies only mirroring and hit flash.
function sixFrames(base: PixelFrame): PixelSprite['frames'] {
  return { idle: [base, base], attack: [base, base], hit: [base], faint: [base] };
}

export const SPRITES: Readonly<Record<string, PixelSprite>> = {
  Basilisk: { palette: { O: '#064e3b', A: '#6ee7b7', B: '#208060', C: '#d1fae5' }, frames: sixFrames(serpent) },
  Gladiator: { palette: { O: '#713f12', A: '#facc15', B: '#ca8a04', C: '#fb7185' }, frames: sixFrames(warrior) },
  Jinn: { palette: { O: '#164e63', A: '#67e8f9', B: '#0e7490', C: '#cffafe' }, frames: sixFrames(smoke) },
  Minotaur: { palette: { O: '#7c2d12', A: '#f97316', B: '#9a3412', C: '#fde68a' }, frames: sixFrames(bull) },
  'Weeping Angel': { palette: { O: '#4c1d95', A: '#c4b5fd', B: '#7c3aed', C: '#ede9fe' }, frames: sixFrames(angel) },
  fallback: { palette: { O: '#1e293b', A: '#94a3b8', B: '#475569', C: '#e2e8f0' }, frames: sixFrames(beast) },
};

export function spriteFor(creatureType: string): PixelSprite {
  return SPRITES[creatureType] ?? SPRITES.fallback;
}
