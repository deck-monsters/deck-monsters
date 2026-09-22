import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Layout invariants that live in CSS and that jsdom cannot exercise, since it does no
 * layout. Asserted against the stylesheet text in the same spirit as
 * `theme-palettes.test.ts` — every one of these encodes a bug that already happened once.
 */
const CSS = readFileSync(join(process.cwd(), 'src/styles/terminal.css'), 'utf8');

/** The rules that only apply while the roster is one column wide. */
function denseBlock(): string {
  const start = CSS.indexOf('@container (max-width: 45.99rem)');
  expect(start, 'the single-column dense tier').toBeGreaterThan(-1);
  // Balance braces from the at-rule's opening brace to find its end.
  let depth = 0;
  for (let i = CSS.indexOf('{', start); i < CSS.length; i += 1) {
    if (CSS[i] === '{') depth += 1;
    else if (CSS[i] === '}') {
      depth -= 1;
      if (depth === 0) return CSS.slice(start, i + 1);
    }
  }
  throw new Error('unbalanced dense block');
}

const shrinkOf = (block: string, selector: string): number => {
  const rule = new RegExp(`\\${selector}\\s*\\{[^}]*?flex:\\s*(\\d+)\\s+(\\d+)`, 's');
  const match = rule.exec(block);
  expect(match, `${selector} declares a flex shorthand`).not.toBeNull();
  return Number(match![2]);
};

describe('roster layout invariants', () => {
  it('lets the dense meta line give up space long before the name does', () => {
    // Flex distributes shrinkage by `shrink × basis`, so equal shrink factors let a long
    // beastmaster name eat the monster's name — at 320px a 32-character beastmaster
    // squeezed "Gin" to nothing. The name is priority one; its metadata is not.
    const block = denseBlock();

    expect(shrinkOf(block, '.roster-list-dense .roster-row-sub'))
      .toBeGreaterThan(shrinkOf(block, '.roster-list-dense .roster-row-head'));
  });

  it('keeps the name and the meta line able to ellipse at all', () => {
    // `min-width: 0` is what allows an overflowing flex child to shrink below its
    // content width; without it the row grows past the pane instead of clipping.
    const block = denseBlock();

    for (const selector of ['.roster-row-head', '.roster-row-sub']) {
      const rule = new RegExp(`\\${selector}\\s*\\{[^}]*min-width:\\s*0`, 's');
      expect(rule.test(block), `${selector} can shrink below its content`).toBe(true);
    }
  });

  it('grows the roster to more columns only at honest widths', () => {
    // 13rem columns were narrower than a row needs and collapsed names to "G.." (#168).
    // A comfortable row spends ~124px on gutter, icon and rail before any text.
    expect(CSS).toContain('@container (min-width: 46rem)');
    expect(CSS).toContain('@container (min-width: 70rem)');
    // Explicit tiers, not auto-fit: auto-fit keeps adding columns on an ultrawide until
    // the rows are unreadable again. (The stylesheet's comments name auto-fit to explain
    // why it is gone, so only the declarations themselves are checked.)
    const columnDecls = CSS.match(/grid-template-columns:[^;]*/g) ?? [];
    expect(columnDecls.length).toBeGreaterThan(0);
    expect(columnDecls.some((decl) => decl.includes('auto-fit'))).toBe(false);
  });

  it('keeps the turn marker out of the row\'s flow', () => {
    // The marker held a flex column plus the row's gap, so every row reserved ~19px for
    // a mark at most one row ever shows — and none between fights — leaving the icons
    // visibly inboard of the section header and the feed text. It hangs in the row's
    // left padding now, which is also what keeps a name from shifting as the turn moves.
    const turnRule = /\.roster-turn\s*\{[^}]*\}/s.exec(CSS)?.[0] ?? '';

    expect(turnRule).toContain('position: absolute');
    expect(turnRule).not.toMatch(/flex:/);
    // And the row has to be the positioning context, or the marker escapes to the pane.
    const rowRule = /\.roster-row\s*\{[^}]*\}/s.exec(CSS)?.[0] ?? '';
    expect(rowRule).toContain('position: relative');
  });

  it('keeps the roster flowing row-major, because row order is the order of play', () => {
    // `grid-auto-flow: column` would renumber the round down each column.
    const listRule = /\.roster-list\s*\{[^}]*\}/s.exec(CSS)?.[0] ?? '';
    expect(listRule).not.toContain('grid-auto-flow');
  });
});
