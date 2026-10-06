import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolved from this file, not process.cwd(), so it works from the repo root too.
const STYLES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../styles');

/** Tokens every theme must define, or components fall back to an unstyled default. */
const REQUIRED_TOKENS = [
  '--color-bg',
  '--color-fg',
  '--color-fg-bright',
  '--color-fg-dim',
  '--color-accent',
  '--color-system',
  '--color-error',
  '--color-success',
  '--color-border',
  '--color-input-bg',
  '--color-choice-hover',
  '--color-choice-selected',
  // The health-bar ramp is its own set of tokens on purpose — see the note in any
  // theme file. Required so a new theme cannot silently fall back to the semantic
  // colours, which are not ordered by brightness.
  '--color-hp-healthy',
  '--color-hp-hurt',
  '--color-hp-critical',
  // Read by components with a fallback but never set before roadmap 46 pass 46a; every
  // theme now states them so a light theme cannot inherit a dark-theme guess (the yellow
  // accent-muted fallback, the white-5% hover).
  '--color-bg-elevated',
  '--color-hover',
  '--color-accent-muted',
  '--color-warning',
];

/** Plumbing tokens phosphor's :root must define so every theme inherits a default. */
const ROOT_DEFAULT_TOKENS = [
  '--font-ui', '--font-mono', '--radius-sm', '--radius-md', '--radius-lg', '--radius-pill',
  '--border-width', '--color-border-strong', '--shadow-page', '--surface-page',
  '--surface-texture', '--surface-titlebar', '--holo', '--color-meter-track',
  '--color-on-accent', '--color-highlight-good', '--color-highlight-warn',
  '--color-sprite-flash', '--color-backdrop', '--color-backdrop-light',
  '--wash-lilac', '--wash-seafoam', '--wash-blush', '--wash-butter', '--wash-sky',
];

/**
 * Known failures of the contrast rules below, recorded rather than fixed: pass 46a must not
 * change a pixel of the four existing themes, so a theme that fails a rule it was never held
 * to is listed here, with the measured ratio, until someone chooses to retune its colours.
 * Key: `${file}|${rule}`. Delete an entry when the palette is fixed; the test fails if an
 * entry no longer fails, so the list cannot rot. Values are the measured ratios; 4.5:1 is
 * needed for text, 3:1 for the meter fill.
 */
const KNOWN_FAILURES: Record<string, string> = {
  'theme-amber.css|--color-fg-dim on --color-bg': '3.07:1',
  'theme-amber.css|--color-fg-dim on --color-input-bg': '3.05:1',
  'theme-amber.css|--color-system on --color-bg': '2.30:1',
  'theme-amber.css|--color-system on --color-input-bg': '2.29:1',
  'theme-amber.css|--color-hp-critical on --color-meter-track': '2.48 (needs 3)',
  'theme-phosphor.css|--color-fg-dim on --color-bg': '3.58:1',
  'theme-phosphor.css|--color-fg-dim on --color-input-bg': '3.33:1',
  'theme-phosphor.css|--color-system on --color-bg': '3.59:1',
  'theme-phosphor.css|--color-system on --color-input-bg': '3.34:1',
  'theme-phosphor.css|--color-hp-critical on --color-meter-track': '2.22 (needs 3)',
  'theme-street-fighter.css|--color-fg-dim on --color-bg': '2.30:1',
  'theme-street-fighter.css|--color-fg-dim on --color-input-bg': '2.24:1',
  'theme-street-fighter.css|--color-system on --color-bg': '2.67:1',
  'theme-street-fighter.css|--color-system on --color-input-bg': '2.60:1',
  'theme-street-fighter.css|--color-accent on --color-bg': '3.99:1',
  'theme-street-fighter.css|--color-accent on --color-input-bg': '3.89:1',
  'theme-street-fighter.css|--color-on-accent on --color-accent': '3.99:1',
  'theme-street-fighter.css|--color-hp-critical on --color-meter-track': '2.40 (needs 3)',
};

function themeFiles(): string[] {
  return readdirSync(STYLES_DIR).filter(f => f.startsWith('theme-') && f.endsWith('.css'));
}

function tokensIn(css: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const line of css.split('\n')) {
    const match = line.match(/^\s*(--color-[a-z-]+)\s*:\s*([^;]+);/);
    if (match) found.set(match[1]!, match[2]!.trim());
  }
  return found;
}

/** Every `--name: value;` line, not just colours (the plumbing tokens). */
function allTokensIn(css: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const line of css.split('\n')) {
    const match = line.match(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/);
    if (match) found.set(match[1]!, match[2]!.trim());
  }
  return found;
}

/**
 * Resolve a token to a literal, following `var(--x)` first in the theme and then in
 * phosphor's :root defaults. This mirrors the browser: every theme sets its values on
 * <html>, so a default such as `--color-meter-track: var(--color-border)` on :root picks up
 * the active theme's own --color-border.
 */
function resolve(name: string, theme: Map<string, string>, root: Map<string, string>, depth = 0): string | null {
  const raw = theme.get(name) ?? root.get(name);
  if (raw === undefined || depth > 8) return null;
  const ref = raw.match(/^var\((--[a-z0-9-]+)\)$/);
  return ref ? resolve(ref[1]!, theme, root, depth + 1) : raw;
}

// --- WCAG relative luminance / contrast -------------------------------------
function parseHex(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

type Rgba = [number, number, number, number];

/** #rrggbb, rgb(r g b), rgb(r g b / a) and rgba(r, g, b, a). Anything else: null. */
function parseColor(value: string): Rgba | null {
  const hex = parseHex(value);
  if (hex) return [...hex, 1];
  const m = value.trim().match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i);
  if (!m) return null;
  const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return [Number(m[1]), Number(m[2]), Number(m[3]), a];
}

/** Alpha-blend `top` over an opaque `under`, as the browser paints it. */
function flatten(top: Rgba, under: Rgba): string {
  const mix = (i: 0 | 1 | 2) => Math.round(top[i] * top[3] + under[i] * (1 - top[3]));
  return '#' + [mix(0), mix(1), mix(2)].map(n => n.toString(16).padStart(2, '0')).join('');
}

function contrast(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const ROOT_TOKENS = allTokensIn(readFileSync(join(STYLES_DIR, 'theme-phosphor.css'), 'utf8'));

describe('theme palettes', () => {
  it('gives phosphor :root a default for every plumbing token', () => {
    expect(ROOT_DEFAULT_TOKENS.filter(t => !ROOT_TOKENS.has(t))).toEqual([]);
  });

  it('keeps the defaults equal to what the app drew before they existed', () => {
    // A drive-by edit to one of these changes every theme that does not override it.
    const expected: Record<string, string> = {
      '--font-ui': 'var(--font-family)', '--font-mono': 'var(--font-family)',
      '--radius-sm': '0', '--radius-md': '0', '--radius-lg': '0', '--radius-pill': '999px',
      '--border-width': '1px', '--color-border-strong': 'var(--color-border)',
      '--shadow-page': 'none', '--surface-page': 'var(--color-bg)',
      '--surface-texture': 'none', '--surface-titlebar': 'none', '--holo': 'none',
      '--color-meter-track': 'var(--color-border)', '--color-on-accent': 'var(--color-bg)',
      '--color-highlight-good': 'var(--color-hp-healthy)', '--color-highlight-warn': 'var(--color-hp-hurt)',
      '--color-sprite-flash': '#ffffff', '--color-backdrop': 'rgb(0 0 0 / 0.7)',
      '--color-backdrop-light': 'rgb(0 0 0 / 0.5)',
      '--wash-lilac': 'transparent', '--wash-seafoam': 'transparent', '--wash-blush': 'transparent',
      '--wash-butter': 'transparent', '--wash-sky': 'transparent',
    };
    expect(Object.fromEntries(ROOT_DEFAULT_TOKENS.map(t => [t, ROOT_TOKENS.get(t)]))).toEqual(expected);
  });

  it('finds the theme stylesheets', () => {
    expect(themeFiles().length).toBeGreaterThanOrEqual(4);
  });

  themeFiles().forEach((file) => {
    describe(file, () => {
      const css = readFileSync(join(STYLES_DIR, file), 'utf8');
      const tokens = tokensIn(css);
      const themeTokens = allTokensIn(css);
      const val = (name: string) => resolve(name, themeTokens, ROOT_TOKENS);

      /** Assert `fg` on `bg` meets `min`, or is a listed known failure. */
      function expectContrast(rule: string, fg: string, bg: string, min: number) {
        const rawFg = val(fg);
        const rawBg = val(bg);
        expect(rawFg, `${file}: ${fg} should resolve to a colour`).not.toBeNull();
        expect(rawBg, `${file}: ${bg} should resolve to a colour`).not.toBeNull();
        const page = parseColor(val('--color-bg') ?? '');
        const pf = parseColor(rawFg!);
        const pb = parseColor(rawBg!);
        // Never skip silently: a translucent or unusual value (Millefleur's meter track is
        // rgb(... / 0.28)) must be evaluated or the rule is not enforcing anything.
        if (!page || !pf || !pb || page[3] !== 1) {
          expect.fail(`${file}: ${rule}: cannot evaluate "${rawFg}" on "${rawBg}"; use hex or rgb()/rgba() over an opaque --color-bg`);
        }
        // The pair's background is painted over the page; the foreground over that.
        const bgFlat = flatten(pb, page);
        const fgFlat = flatten(pf, parseColor(bgFlat)!);
        const ratio = contrast(fgFlat, bgFlat)!;
        const key = `${file}|${rule}`;
        if (key in KNOWN_FAILURES) {
          expect.soft(ratio, `${key} is listed as failing but now passes; remove it from KNOWN_FAILURES`).toBeLessThan(min);
          return;
        }
        expect.soft(ratio, `${file}: ${rule} (${fg} on ${bg}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(min);
      }

      // street-fighter and phosphor define the full set; a partial theme that only
      // overrides a few tokens would silently inherit the rest, so require all.
      it('defines every required colour token', () => {
        const missing = REQUIRED_TOKENS.filter(t => !tokens.has(t));
        expect(missing, `${file} is missing tokens`).toEqual([]);
      });

      it('meets WCAG AA (4.5:1) for body text against its own background', () => {
        const bg = tokens.get('--color-bg')!;
        const fg = tokens.get('--color-fg')!;
        const ratio = contrast(fg, bg);
        if (ratio === null) return; // non-hex (e.g. var()) — skip
        expect(ratio, `${file}: --color-fg on --color-bg`).toBeGreaterThanOrEqual(4.5);
      });

      it('keeps the HP-bar ramp monotonic in luminance so it reads without hue', () => {
        // A draining health bar must read as draining in greyscale and for a
        // colour-blind viewer, so the three stages have to fall in brightness — not
        // merely differ in hue. Monotonicity alone is not enough: two colours can be
        // ordered yet only 1.00:1 apart, which is invisible. Require a real step.
        const healthy = tokens.get('--color-hp-healthy')!;
        const hurt = tokens.get('--color-hp-hurt')!;
        const critical = tokens.get('--color-hp-critical')!;

        const lh = luminance(healthy);
        const lu = luminance(hurt);
        const lc = luminance(critical);
        if (lh === null || lu === null || lc === null) return;

        expect(lh, `${file}: healthy must be brighter than hurt`).toBeGreaterThan(lu);
        expect(lu, `${file}: hurt must be brighter than critical`).toBeGreaterThan(lc);

        expect(contrast(healthy, hurt)!, `${file}: healthy→hurt step too small to see`)
          .toBeGreaterThanOrEqual(1.3);
        expect(contrast(hurt, critical)!, `${file}: hurt→critical step too small to see`)
          .toBeGreaterThanOrEqual(1.3);
      });

      it('keeps every HP-bar stage visible against the background', () => {
        const bg = tokens.get('--color-bg')!;
        (['--color-hp-healthy', '--color-hp-hurt', '--color-hp-critical'] as const).forEach((token) => {
          const ratio = contrast(tokens.get(token)!, bg);
          if (ratio === null) return;
          // 3:1 is the WCAG minimum for a non-text UI component.
          expect(ratio, `${file}: ${token} on --color-bg`).toBeGreaterThanOrEqual(3);
        });
      });

      for (const surface of ['--color-bg', '--color-input-bg'] as const) {
        it(`keeps secondary and status text at 4.5:1 on ${surface}`, () => {
          for (const token of ['--color-fg-dim', '--color-accent', '--color-system', '--color-error', '--color-success']) {
            expectContrast(`${token} on ${surface}`, token, surface, 4.5);
          }
        });
      }

      it('keeps text on an accent fill (tab badges) at 4.5:1', () => {
        expectContrast('--color-on-accent on --color-accent', '--color-on-accent', '--color-accent', 4.5);
      });

      it('keeps every HP-bar stage at 3:1 on the meter track', () => {
        for (const token of ['--color-hp-healthy', '--color-hp-hurt', '--color-hp-critical']) {
          expectContrast(`${token} on --color-meter-track`, token, '--color-meter-track', 3);
        }
      });

      it('keeps highlight-tag text at 4.5:1 on the page', () => {
        for (const token of ['--color-highlight-good', '--color-highlight-warn']) {
          expectContrast(`${token} on --color-bg`, token, '--color-bg', 4.5);
        }
      });
    });
  });
});
