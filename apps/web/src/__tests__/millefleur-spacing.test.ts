import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Layout invariants that live in the Millefleur stylesheet and that jsdom cannot exercise,
 * since it does no layout. Same approach as `roster-layout-css.test.ts`: the declarations
 * themselves are what a later edit would drop, and each one encodes a bug that already
 * happened (bug 241).
 */
const CSS = readFileSync(join(process.cwd(), 'src/styles/theme-millefleur.css'), 'utf8');

/** The body of the rule whose selector is exactly `selector` (not a grouped or descendant one). */
function exactRule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 's').exec(CSS);
  expect(match, `${selector} declares its own rule`).not.toBeNull();
  return match![1];
}

describe('Millefleur spacing invariants', () => {
  it('top-aligns the chat sender and timestamp so their 28px boxes share one row', () => {
    // Different font sizes, each with line-height 28px, baseline-align into a 29px header.
    // One extra pixel per message walks the text off the ruled paper.
    expect(exactRule("[data-theme='millefleur'] .chat-sender")).toContain('vertical-align: top');
    expect(exactRule("[data-theme='millefleur'] .chat-time")).toContain('vertical-align: top');
  });

  it('keeps a wrapped shop wallet at the trailing edge', () => {
    // The section header's space-between packs a lone second line to the start, so the
    // balance jumped from the right edge to the left the moment it wrapped.
    const heading = exactRule("[data-theme='millefleur'] .shop-heading");
    expect(heading).toContain('flex-wrap: wrap');
    expect(heading).toContain('justify-content: flex-end');
    expect(heading).not.toContain('space-between');
  });
});
