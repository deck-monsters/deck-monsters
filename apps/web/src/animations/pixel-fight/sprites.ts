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

/**
 * Monsters are hand-drawn as 24x24 maps. The first cut was 16x16 and every monster came
 * out as the same rounded blob — at that size a head, a limb and a horn are one or two
 * pixels each, so nothing survived to tell a bull from an angel. 24 leaves room for a
 * silhouette.
 *
 * Palette keys, darkest to lightest, so a map reads as shading and not as noise:
 *   O outline   D shadow   B body   A lit body   C highlight (horn/metal/fang)   E eye
 * Every monster uses the same six keys, so a map can be re-tinted without redrawing.
 */
const serpent: PixelFrame = [
  '........................',
  '............OOOOOO......',
  '..........OODBBBBDO.....',
  '.........ODBAAAAAABO....',
  '.........OBAAECAAAABO...',
  '.........OBAAAAAAAAABO..',
  '.........ODBAAAAAAABOEE.',
  '......OOOODBBBBBBBDOO.E.',
  '.....ODBBBBBBBBBDOO.....',
  '....ODBAAAAADBDOO.......',
  '....OBAAAADBDOO.........',
  '....OBAAADBDO...........',
  '....ODBAADBDO...........',
  '..OOODBBDBDOOOO.........',
  '.OODBBBBBBBBBBBBDOO.....',
  'ODBBAAADAAADAAAADBBDO...',
  'OBAAADAAADAAAADAAAABDO..',
  'OBBAAADAAADAAAADAAAABBO.',
  'OBAAADAAADAAAADAAAAABDO.',
  'ODBAAADAAADAAAADAAAABDOO',
  '.ODBBAAADAAADAAAADBBDOOO',
  '..OODBBBBBBBBBBBBDOODBDO',
  '....OOOOOOOOOOOOOO..OOO.',
  '........................',
];
const warrior: PixelFrame = [
  '........................',
  '..........OOO...........',
  '.........OCCCO..........',
  '.......OOCCCCCO.........',
  '......OCCCCCCCDO........',
  '......OOOOOOOOOO........',
  '......ODDDDDDDDO..OO....',
  '......ODBBBBBBDO..OCO...',
  '......OBAAAAAABO..OCO...',
  '......OBAOOAAEEO..OCO...',
  '......OBAAAAAAAO..OCO...',
  '......OODBBBBDOO..OCO...',
  '........OBBBBO...OOCOO..',
  '..OOOOOODBBBBDOOOOODDO..',
  '.OCAAACODBBBBBBDOBAAAO..',
  '.OCAAACOBAAAAAABOBBOO...',
  '.OCAAACODBBBBBBDOO......',
  '.OCAAACOODBBBBDOO.......',
  '..OOOOO..ODBBBBDO.......',
  '.........ODBOOBDO.......',
  '........OBAAO.OAABO.....',
  '........OBAAO.OAABO.....',
  '.......OOAAOO.OOAAOO....',
  '.......OOOOO...OOOOO....',
];

const smoke: PixelFrame = [
  '........................',
  '.........OOOO...........',
  '........OCCCCO..........',
  '........OOCCOO..........',
  '.......OODDDDOO.........',
  '......ODBBBBBBDO........',
  '......OBAAAAAAABO.......',
  '......OBAEOAAEOABO......',
  '......OBAAAAAAAABO......',
  '......OODBBBBBBDOO......',
  '...OOOOOODBBBBDOOOOOO...',
  '..OBAAAAOODBBDOOAAAABO..',
  '..OBAAAAOOOBBOOOAAAABO..',
  '...OOOOOOOOBBOOOOOOOO...',
  '..........OBBO..........',
  '.........OOBBOO.........',
  '........ODBBBBDO........',
  '.......ODBBBBBBDO.......',
  '......ODBBBBBBBBDO......',
  '.....ODBBBBBBBBBBDO.....',
  '....ODBBBBBBBBBBBBDO....',
  '...ODBBBBBBBBBBBBBBDO...',
  '...OODDDDDDDDDDDDDDOO...',
  '....OOOOOOOOOOOOOOOO....',
];

const bull: PixelFrame = [
  '........................',
  '...OOO..........OOO.....',
  '..OCCCO........OCCCO....',
  '..OCCO..........OCCO....',
  '...OCO...OOOO...OCO.....',
  '...OCOOOODDDDOOOOCO.....',
  '....OOODBBBBBBDOOO......',
  '.....ODBAAAAAABDO.......',
  '.....OBAEOAAOEABO.......',
  '.....OBAAAAAAAABO.......',
  '.....OODBBBBBBDOO.......',
  '.......OCOOOOCO.........',
  '......OOCCCCCCOO........',
  '...OOOODBBBBBBDOOOO.....',
  '..ODBBBBBBBBBBBBBBDO....',
  '.ODBBAAAAAAAAAAAABBDO...',
  '.OBBAAAAAAAAAAAAAAABO...',
  '.OBBAAAAAAAAAAAAAAABO...',
  '.ODBBAAAAAAAAAAAABBDO...',
  '..OODBBBBOOOOBBBBDOO....',
  '....OBBBO....OBBBO......',
  '....OBBBO....OBBBO......',
  '...OOCCCOO..OOCCCOO.....',
  '...OOOOOO....OOOOOO.....',
];

const angel: PixelFrame = [
  '........................',
  '.........OOOO...........',
  '........ODCCCDO.........',
  '........OCAAAACO........',
  '........OCAAAACO........',
  '..OOO...OCAAAACO..OOO...',
  '.OCCCO..OODDDDOO.OOCCCO.',
  '.OCAAACO.ODBBBDO.OCAAACO',
  '.OCAAAACOOBAEEABOOCAAAAO',
  '.OCAAAACOOBACCABOOCAAAAO',
  '..OCAAACOOBACCABOOCAAACO',
  '..OCAAACOODBBDOOCAAACO..',
  '...OCAACOOOBBOOOCAACO...',
  '....OCCOOOOBBOOOOCCO....',
  '.....OOOOODBBDOOOOO.....',
  '.........ODBBDO.........',
  '........ODBBBBDO........',
  '.......ODBAAAABDO.......',
  '......ODBAAAAAABDO......',
  '.....ODBAAAAAAAABDO.....',
  '....ODBBAAAAAAAABBDO....',
  '....OBBBAAAAAAAABBBO....',
  '....OBBBBBBBBBBBBBBO....',
  '....OOOOOOOOOOOOOOOO....',
];

const beast: PixelFrame = [
  '........................',
  '..............OOOO......',
  '.............ODDDDO.....',
  '............ODBBBBDO....',
  '..OOO.......OBAAAAABO...',
  '.OCCCO......OBAEOAAABO..',
  '.OCCCO......OBAAAAAAABO.',
  '..OCCO.OOOOOODBBBBBBBO..',
  '...OCOODBBBBOOCCCCCCO...',
  '...OCODBBBBBBDOOOOOO....',
  '....OODBBBBBBBDO........',
  '...ODBBAAAAAAABBDO......',
  '..ODBBAAAAAAAAAABBDO....',
  '..OBBAAAAAAAAAAAAABO....',
  '..OBBAAAAAAAAAAAAABO....',
  '..ODBBAAAAAAAAAABBDO....',
  '...ODBBBBBBBBBBBBDO.....',
  '...OOBBOOOOOOOOBBOO.....',
  '....OBBO......OBBO......',
  '....OBBO......OBBO......',
  '....ODBO......ODBO......',
  '...OOCCOO....OOCCOO.....',
  '...OOOOOO....OOOOOO.....',
  '........................',
];

/** Size of a hand-drawn map, and the visual footprint a fighter occupies on screen. */
const ART = 24;

/**
 * Poses are rendered on a grid wider than the art. `lean` swings the top of the sprite
 * up to 4px sideways and the strike shifts 1px further, so a pose needs 5 columns of
 * slack on each side — 6 here, to leave a drawing room to grow. Without them the lunge
 * quietly ate wingtips and horns. Padding the grid keeps that a property of the
 * renderer instead of a "keep inside columns 2..21" rule every drawing must remember.
 */
const PAD = 6;
const COLS = ART + PAD * 2;
const EMPTY_ROW = '.'.repeat(COLS);

function shiftRow(row: string, dx: number): string {
  if (dx === 0) return row;
  return dx > 0 ? '.'.repeat(dx) + row.slice(0, COLS - dx) : row.slice(-dx) + '.'.repeat(-dx);
}

/** Centre a 24-wide art map on the 32-wide pose grid. */
function pad(frame: PixelFrame): PixelFrame {
  const gutter = '.'.repeat(PAD);
  return frame.map((row) => gutter + row + gutter);
}

/** Translate a padded frame by whole pixels. */
function shift(frame: PixelFrame, dx: number, dy: number): PixelFrame {
  return Array.from({ length: ART }, (_, y) => {
    const source = frame[y - dy];
    return source === undefined ? EMPTY_ROW : shiftRow(source, dx);
  });
}

/**
 * Lean the sprite about its feet: the bottom row holds still and each row above travels
 * further, up to `amount` at the top. This is what makes an attack read as a lunge.
 * The previous version translated the whole sprite instead, so every pose was the same
 * drawing at a different offset and the fight looked frozen — a reviewer flagged exactly
 * that ("frames reuse the base map") and it shipped anyway. A shear changes the shape.
 */
function lean(frame: PixelFrame, amount: number): PixelFrame {
  return frame.map((row, y) => shiftRow(row, Math.round((amount * (ART - 1 - y)) / (ART - 1))));
}

/** Turn the standing pose on its side (90° clockwise) — the fallen pose. */
function lieDown(frame: PixelFrame): PixelFrame {
  return Array.from({ length: ART }, (_, y) =>
    Array.from({ length: ART }, (_, x) => frame[ART - 1 - x]![y]!).join(''),
  );
}

// One hand-drawn literal map per monster is the reviewable artifact; the poses are
// transforms of it so a silhouette change never has to be redrawn six times. Sprites face
// right; the renderer mirrors for the right-hand side and applies the hit flash.
// `lieDown` rotates, so it runs on the square art map before the grid is padded.
function poses(base: PixelFrame): PixelSprite['frames'] {
  const standing = pad(base);
  return {
    // Breathing: a 1px rise, which is how idle bob has always been done.
    idle: [standing, shift(standing, 0, -1)],
    // Wind up away from the opponent, then throw the weight forward into the strike.
    attack: [lean(standing, -3), shift(lean(standing, 4), 1, 0)],
    // Knocked back onto the heels; the renderer flashes this white for 130ms.
    hit: [shift(lean(standing, -4), -1, 0)],
    faint: [pad(lieDown(base))],
  };
}

/** Visual footprint of a fighter, in sprite pixels — what layout and the HP bar align to. */
export const SPRITE_ART = ART;
/** Width of a pose frame, and the art's inset within it. The renderer needs both to
 *  place a frame so that `x` still means "left edge of the art". */
export const SPRITE_COLS = COLS;
export const SPRITE_PAD = PAD;

export const SPRITES: Readonly<Record<string, PixelSprite>> = {
  Basilisk: {
    palette: { O: '#0c3527', D: '#157a58', B: '#22a877', A: '#5fd6a4', C: '#e6fff5', E: '#fbbf24' },
    frames: poses(serpent),
  },
  Gladiator: {
    palette: { O: '#402809', D: '#8f6110', B: '#c78f14', A: '#f3c73f', C: '#fff6d0', E: '#ef4444' },
    frames: poses(warrior),
  },
  Jinn: {
    palette: { O: '#08323f', D: '#12708c', B: '#1b9cbd', A: '#56d3ec', C: '#e6fbff', E: '#fde68a' },
    frames: poses(smoke),
  },
  Minotaur: {
    palette: { O: '#3f1806', D: '#8f3a12', B: '#c2601f', A: '#f08b3c', C: '#ffe2b8', E: '#fff1f2' },
    frames: poses(bull),
  },
  'Weeping Angel': {
    palette: { O: '#261550', D: '#5836a8', B: '#7c5cd6', A: '#b6a4f5', C: '#f4f0ff', E: '#67e8f9' },
    frames: poses(angel),
  },
  fallback: {
    palette: { O: '#131c29', D: '#3a4a63', B: '#5b7091', A: '#93a6c2', C: '#e6edf7', E: '#f87171' },
    frames: poses(beast),
  },
};

export function spriteFor(creatureType: string): PixelSprite {
  return SPRITES[creatureType] ?? SPRITES.fallback;
}
