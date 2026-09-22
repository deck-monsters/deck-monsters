import { describe, expect, it } from 'vitest';
import { hexToHsl, paletteFor, tintFromAppearance } from '../animations/pixel-fight/appearance-palette.js';
import { SPRITES } from '../animations/pixel-fight/sprites.js';

const basilisk = SPRITES.Basilisk!.palette;

function hueOf(hex: string): number {
  return hexToHsl(hex).h;
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

describe('tintFromAppearance', () => {
  it('takes the first colour word, which is usually the dominant one', () => {
    // "gold and black diamond patterned" is the spawn prompt's own basilisk example.
    expect(tintFromAppearance('gold and black diamond patterned')?.hue).toBe(46);
  });

  it('reads the colour-name words bosses are given', () => {
    // Boss colours come from grab-color-names.
    expect(tintFromAppearance('medium sea green')?.hue).toBe(165);
    expect(tintFromAppearance('cornflower blue')?.hue).toBe(219);
  });

  it('matches whole words only', () => {
    // "reddened" and "bluster" are not colours; a substring match would say they were.
    expect(tintFromAppearance('reddened with bluster')).toBeNull();
  });

  it('returns null for a description with no colour in it', () => {
    expect(tintFromAppearance('deceptively glorious')).toBeNull();
    expect(tintFromAppearance('')).toBeNull();
    expect(tintFromAppearance(undefined)).toBeNull();
  });

  it('lets a lightness word shade only the colour right after it', () => {
    const plain = tintFromAppearance('blue')!;

    expect(tintFromAppearance('dark blue')!.light).toBeLessThan(plain.light ?? 0);
    expect(tintFromAppearance('dark and stormy blue')!.light ?? 0).toBe(plain.light ?? 0);
  });
});

describe('paletteFor', () => {
  it('recolours the body to the named colour', () => {
    const palette = paletteFor(basilisk, 'crimson scales', 'Stonefang');

    expect(hueDistance(hueOf(palette.B!), 348)).toBeLessThanOrEqual(20);
  });

  it('keeps the species lightness ramp, so the shading still reads', () => {
    // #164: the ramp was spaced by hand; a recolour must not flatten it.
    const palette = paletteFor(basilisk, 'blue', 'Stonefang');
    const order = ['O', 'D', 'B', 'A', 'C'].map((key) => hexToHsl(palette[key]!).l);

    for (let index = 1; index < order.length; index += 1) {
      expect(order[index]!).toBeGreaterThan(order[index - 1]!);
    }
  });

  it('gives two monsters described alike two different palettes', () => {
    // The literal ask: several basilisks in one ring should not all be the same colour —
    // even when both owners wrote "green".
    const first = paletteFor(basilisk, 'green', 'Stonefang');
    const second = paletteFor(basilisk, 'green', 'Gin & Tonic');

    expect(first.B).not.toBe(second.B);
    // …while both still read as green.
    expect(hueDistance(hueOf(first.B!), 130)).toBeLessThanOrEqual(20);
    expect(hueDistance(hueOf(second.B!), 130)).toBeLessThanOrEqual(20);
  });

  it('keeps gold gold whatever the name', () => {
    // Between orange and yellow a small hue shift reads as a different colour, so the name
    // may barely move it there. Rendered with the full spread, a gold basilisk came out orange.
    for (const name of ['Stonefang', 'Gin & Tonic', 'Hissy Fit', 'Slinky', 'Nagini', 'Kaa']) {
      expect(hueDistance(hueOf(paletteFor(basilisk, 'gold', name).B!), 46)).toBeLessThanOrEqual(6);
    }
  });

  it('varies monsters whose appearance names no colour', () => {
    const first = paletteFor(basilisk, 'deceptively glorious', 'Stonefang');
    const second = paletteFor(basilisk, 'deceptively glorious', 'Gin & Tonic');

    expect(first.B).not.toBe(second.B);
  });

  it('does not let free-text names and appearances collide in the memo', () => {
    // Both fields are typed by players; a plain "a|b" cache key would make these one entry.
    const first = paletteFor(basilisk, 'gold|', 'Fang');
    const second = paletteFor(basilisk, 'gold', '|Fang');

    expect(first).not.toBe(second);
  });

  it('is stable: the same monster always gets the same palette', () => {
    expect(paletteFor(basilisk, 'teal', 'Stonefang')).toEqual(paletteFor(basilisk, 'teal', 'Stonefang'));
  });

  it('keeps a black monster visible on a near-black theme', () => {
    const palette = paletteFor(basilisk, 'jet black', 'Stonefang');

    expect(hexToHsl(palette.B!).l).toBeGreaterThanOrEqual(26);
  });

  it('moves the eye off the body colour when the two would merge', () => {
    // The basilisk's eye is amber; a gold basilisk would lose its only facial feature.
    const palette = paletteFor(basilisk, 'gold', 'Stonefang');

    expect(hueDistance(hueOf(palette.E!), hueOf(palette.B!))).toBeGreaterThan(90);
  });
});
