import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const STYLES_DIR = join(process.cwd(), 'src/styles');

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
];

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

function contrast(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

describe('theme palettes', () => {
  it('finds the theme stylesheets', () => {
    expect(themeFiles().length).toBeGreaterThanOrEqual(4);
  });

  themeFiles().forEach((file) => {
    describe(file, () => {
      const css = readFileSync(join(STYLES_DIR, file), 'utf8');
      const tokens = tokensIn(css);

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
    });
  });
});
