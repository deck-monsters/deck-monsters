import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Pass 43 I1: on a 390px phone the second monster sat off the right edge of a sideways
 * carousel with two dots as the only hint. The row is now a plain wrapping grid, so every
 * monster is reachable by scrolling down. jsdom has no layout, so this guards the CSS.
 */
describe('workshop monster row layout', () => {
  const css = readFileSync(join(process.cwd(), 'src/styles/base.css'), 'utf8');

  it('is an auto-fit grid (one column on a phone, two side by side on desktop)', () => {
    expect(css).toMatch(/\.workshop-monster-row\s*\{[^}]*display:\s*grid[^}]*auto-fit/);
  });

  it('never turns into a sideways scroller', () => {
    expect(css).not.toMatch(/\.workshop-monster-row\s*\{[^}]*overflow-x/);
    expect(css).not.toMatch(/scroll-snap-type/);
    expect(css).not.toContain('workshop-monster-dots');
  });
});
