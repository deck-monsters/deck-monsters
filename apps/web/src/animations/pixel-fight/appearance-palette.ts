import type { PixelSprite } from './sprites.js';

type Palette = PixelSprite['palette'];

/**
 * Colours a sprite from the monster's appearance, as its Beastmaster described it.
 *
 * Every monster already has one: the workshop's required "Appearance" field, the same
 * question in the Discord and text flows, and a random colour name for bosses. Reading it
 * means a basilisk its owner called "emerald and gold" renders green, so the variation
 * carries meaning a player chose — rather than a random tint that says nothing. See
 * docs/roadmap/24-pixel-monsters-everywhere.md.
 *
 * Only the **hue and saturation** change. Each species palette's lightness ramp — outline,
 * shadow, body, lit body, highlight — was spaced by hand so a 24px map reads as shading
 * rather than noise (#164), and that spacing survives any recolour. A "black" monster is
 * the one exception, and still keeps its body clear of the near-black backgrounds every
 * theme uses.
 */

interface Tint {
  hue: number;
  /** Target saturation for the body key, 0–1; the other keys keep their relative levels. */
  sat: number;
  /** Lightness shift, in points, applied across the ramp. */
  light?: number;
}

/**
 * Colour words, matched whole. Hues are HSL degrees. Order does not matter; the *first word
 * in the appearance text* that appears here wins, because that is usually the dominant one
 * ("gold and black diamond patterned" is a gold snake with black markings).
 *
 * Bosses' colours come from `grab-color-names` ("Medium Sea Green", "Cornflower Blue"),
 * which is why the compound-name words (sea, sky, forest, wood…) are here as well as the
 * plain ones a player tends to type.
 */
const COLOUR_WORDS: Readonly<Record<string, Tint>> = {
  red: { hue: 0, sat: 0.7 }, reddish: { hue: 0, sat: 0.55 },
  crimson: { hue: 348, sat: 0.72 }, scarlet: { hue: 4, sat: 0.78 }, ruby: { hue: 345, sat: 0.7 },
  blood: { hue: 355, sat: 0.7, light: -6 }, cherry: { hue: 350, sat: 0.7 },
  maroon: { hue: 350, sat: 0.55, light: -10 }, burgundy: { hue: 345, sat: 0.55, light: -10 },
  ember: { hue: 12, sat: 0.8 }, fire: { hue: 14, sat: 0.85 }, flame: { hue: 18, sat: 0.85 },
  rust: { hue: 18, sat: 0.6 }, copper: { hue: 22, sat: 0.6 }, salmon: { hue: 8, sat: 0.6, light: 6 },
  orange: { hue: 28, sat: 0.8 }, tangerine: { hue: 28, sat: 0.85 }, coral: { hue: 12, sat: 0.7 },
  amber: { hue: 40, sat: 0.85, light: 4 }, bronze: { hue: 32, sat: 0.55 }, auburn: { hue: 15, sat: 0.55 },
  chestnut: { hue: 12, sat: 0.45 }, brown: { hue: 25, sat: 0.45, light: -6 },
  brownish: { hue: 25, sat: 0.4, light: -6 }, chocolate: { hue: 22, sat: 0.5, light: -8 },
  wood: { hue: 30, sat: 0.4 }, tan: { hue: 34, sat: 0.35 }, sand: { hue: 40, sat: 0.35 },
  sandy: { hue: 40, sat: 0.35 }, beige: { hue: 40, sat: 0.3, light: 6 }, khaki: { hue: 50, sat: 0.3 },
  gold: { hue: 46, sat: 0.85, light: 8 }, golden: { hue: 46, sat: 0.85, light: 8 }, yellow: { hue: 54, sat: 0.85, light: 12 },
  yellowish: { hue: 54, sat: 0.6, light: 10 }, lemon: { hue: 56, sat: 0.85, light: 12 }, mustard: { hue: 48, sat: 0.6, light: 4 },
  lime: { hue: 85, sat: 0.7 }, olive: { hue: 65, sat: 0.45 }, moss: { hue: 95, sat: 0.45 },
  green: { hue: 130, sat: 0.6 }, greenish: { hue: 130, sat: 0.45 }, forest: { hue: 125, sat: 0.5, light: -6 },
  emerald: { hue: 145, sat: 0.65 }, jade: { hue: 155, sat: 0.55 }, mint: { hue: 155, sat: 0.5, light: 6 },
  sage: { hue: 110, sat: 0.22 }, sea: { hue: 165, sat: 0.5 }, seafoam: { hue: 160, sat: 0.45, light: 6 },
  teal: { hue: 178, sat: 0.6 }, turquoise: { hue: 172, sat: 0.65 }, aqua: { hue: 180, sat: 0.7 },
  cyan: { hue: 188, sat: 0.75 }, sky: { hue: 200, sat: 0.65 }, azure: { hue: 208, sat: 0.7 },
  blue: { hue: 220, sat: 0.65 }, bluish: { hue: 220, sat: 0.5 }, cobalt: { hue: 222, sat: 0.7 },
  sapphire: { hue: 225, sat: 0.7 }, cornflower: { hue: 219, sat: 0.6 }, steel: { hue: 207, sat: 0.3 },
  navy: { hue: 228, sat: 0.6, light: -8 }, indigo: { hue: 250, sat: 0.6 }, violet: { hue: 270, sat: 0.6 },
  purple: { hue: 280, sat: 0.6 }, purplish: { hue: 280, sat: 0.45 }, lavender: { hue: 265, sat: 0.5, light: 8 },
  lilac: { hue: 285, sat: 0.45, light: 6 }, orchid: { hue: 300, sat: 0.5 }, plum: { hue: 300, sat: 0.4, light: -4 },
  magenta: { hue: 310, sat: 0.7 }, fuchsia: { hue: 315, sat: 0.75 }, pink: { hue: 335, sat: 0.65, light: 6 },
  pinkish: { hue: 335, sat: 0.5, light: 6 }, rose: { hue: 340, sat: 0.6 },
  // Neutrals: nearly no saturation, so the hue is only a faint cast.
  black: { hue: 220, sat: 0.08, light: -16 }, blackish: { hue: 220, sat: 0.08, light: -12 },
  ebony: { hue: 220, sat: 0.08, light: -16 }, onyx: { hue: 220, sat: 0.06, light: -16 },
  obsidian: { hue: 250, sat: 0.12, light: -16 }, jet: { hue: 220, sat: 0.08, light: -16 },
  charcoal: { hue: 210, sat: 0.08, light: -10 }, coal: { hue: 210, sat: 0.06, light: -12 },
  shadow: { hue: 230, sat: 0.1, light: -12 }, dusk: { hue: 250, sat: 0.2, light: -6 },
  grey: { hue: 210, sat: 0.06 }, gray: { hue: 210, sat: 0.06 }, greyish: { hue: 210, sat: 0.06 },
  grayish: { hue: 210, sat: 0.06 }, ash: { hue: 30, sat: 0.05 }, ashen: { hue: 30, sat: 0.05 },
  slate: { hue: 215, sat: 0.15 }, stone: { hue: 35, sat: 0.08 }, stony: { hue: 35, sat: 0.08 },
  silver: { hue: 210, sat: 0.08, light: 8 }, white: { hue: 45, sat: 0.08, light: 12 },
  whitish: { hue: 45, sat: 0.08, light: 10 }, ivory: { hue: 50, sat: 0.2, light: 12 },
  pearl: { hue: 40, sat: 0.12, light: 12 }, bone: { hue: 40, sat: 0.15, light: 10 },
  snow: { hue: 200, sat: 0.1, light: 12 }, alabaster: { hue: 40, sat: 0.1, light: 12 },
};

/** Words that shade whichever colour they sit beside, in lightness points. */
const LIGHTNESS_MODIFIERS: Readonly<Record<string, number>> = {
  dark: -8, deep: -8, dim: -6, dusky: -6, light: 8, pale: 10, bright: 6, pastel: 10,
};

/** Lowest lightness a body pixel may take, so a "black" monster stays visible on a black theme. */
const BODY_FLOOR = 26;

/** Returns the tint an appearance describes, or null when it names no colour. */
export function tintFromAppearance(appearance: string | undefined): Tint | null {
  if (!appearance) return null;
  const words = appearance.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  let modifier = 0;
  for (const word of words) {
    const tint = COLOUR_WORDS[word];
    if (tint) return { ...tint, light: (tint.light ?? 0) + modifier };
    // A modifier only counts for the colour right after it: "dark and stormy blue" is not
    // a dark blue, but "dark blue" is.
    modifier = LIGHTNESS_MODIFIERS[word] ?? 0;
  }
  return null;
}

/** A small, stable number in [-1, 1] from a string — the same monster always gets the same one. */
function jitter(seed: string, salt: number): number {
  // FNV-1a. Not for security; only needs to spread similar names apart.
  let hash = 2166136261 ^ salt;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 2001) / 1000 - 1;
}

/**
 * How far a name may nudge the hue. Two owners who both wrote "green" still get two
 * greens, not one — the literal ask ("multiple basilisks in the ring [shouldn't] all have
 * the same color"). Kept small when a colour was named so the monster still reads as what
 * its owner described; wider when none was, since then there is no description to honour.
 */
const NAMED_HUE_SPREAD = 20;
const UNNAMED_HUE_SPREAD = 32;
const LIGHT_SPREAD = 9;

/**
 * Hue is perceived unevenly: 20° is barely visible among greens and blues but turns gold
 * into orange and yellow into olive. Rendered, a "gold and black" basilisk came out orange
 * with the full spread — so between orange and yellow the name leans on lightness instead
 * and the hue barely moves.
 */
function hueSpreadAt(hue: number, named: boolean): number {
  const narrow = hue >= 18 && hue <= 70;
  if (narrow) return 6;
  return named ? NAMED_HUE_SPREAD : UNNAMED_HUE_SPREAD;
}

/** Keys that form the body's shading ramp. `E` (the eye) is handled separately. */
const RAMP_KEYS = ['O', 'D', 'B', 'A', 'C'] as const;

const cache = new Map<string, Palette>();

/**
 * The palette to draw a monster with: its species palette, recoloured by its appearance and
 * nudged by its name. Pure and memoised — the roster redraws every frame.
 */
export function paletteFor(base: Palette, appearance: string | undefined, name: string): Palette {
  const cacheKey = `${JSON.stringify(base)}|${appearance ?? ''}|${name}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const tint = tintFromAppearance(appearance);
  const baseBody = hexToHsl(base.B!);
  const targetHue = tint?.hue ?? baseBody.h;
  const hue = wrapHue(targetHue + jitter(name, 1) * hueSpreadAt(targetHue, Boolean(tint)));
  const lightShift = (tint?.light ?? 0) + jitter(name, 2) * LIGHT_SPREAD;
  // Saturation is scaled rather than replaced so the highlight stays near-white and the
  // outline stays near-black, exactly as the species palette had them.
  const satScale = tint ? tint.sat / Math.max(baseBody.s, 0.01) : 1;

  const palette: Record<string, string> = { ...base };
  for (const key of RAMP_KEYS) {
    const original = hexToHsl(base[key]!);
    let light = clamp(original.l + lightShift, 4, 97);
    if (key === 'B' || key === 'A') light = Math.max(light, BODY_FLOOR + (key === 'A' ? 14 : 0));
    palette[key] = hslToHex(hue, clamp(original.s * satScale, 0, 1), light);
  }

  // The eye is the one accent a 24px face has. If the new body hue swallowed it — a
  // basilisk's amber eye on a gold basilisk — swing it to the opposite side of the wheel.
  const eye = hexToHsl(base.E!);
  if (tint && tint.sat > 0.15 && hueDistance(eye.h, hue) < 50) {
    palette.E = hslToHex(wrapHue(hue + 180), Math.max(eye.s, 0.7), eye.l);
  }

  cache.set(cacheKey, palette);
  return palette;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function wrapHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

function hueDistance(a: number, b: number): number {
  const distance = Math.abs(a - b) % 360;
  return distance > 180 ? 360 - distance : distance;
}

/** `#rrggbb` → HSL with `s` in 0–1 and `l` in 0–100. */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lightness - chroma / 2;
  const [r, g, b] =
    h < 60 ? [chroma, x, 0] :
    h < 120 ? [x, chroma, 0] :
    h < 180 ? [0, chroma, x] :
    h < 240 ? [0, x, chroma] :
    h < 300 ? [x, 0, chroma] :
    [chroma, 0, x];
  const channel = (value: number) =>
    Math.round((value + m) * 255).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}
