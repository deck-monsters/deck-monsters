import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const css = readFileSync(join(process.cwd(), 'src/styles/base.css'), 'utf8');

/** Pull one rule body out of the stylesheet by selector. */
function ruleBody(selector: string): string {
  const match = css.match(
    new RegExp(`(^|\\})\\s*${selector.replace(/[.*]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`, 'm')
  );
  expect(match, `expected a \`${selector}\` rule in base.css`).toBeTruthy();
  return match![2]!;
}

describe('workshop scrolls instead of crushing its rows (#116)', () => {
  // `.workshop-view` is both the scroll container and a flex column. Flex items shrink
  // before a scroll container scrolls, so at phone width — two-column card grid, tall
  // inventory — the monster row was squashed from 433px to 142px and the panel contents
  // spilled over the inventory below. Measured in Chromium at 393px, where
  // `scrollHeight === clientHeight` proved the view never scrolled at all.
  it('.workshop-view is still the flex column that made this possible', () => {
    const body = ruleBody('.workshop-view');
    expect(body).toMatch(/flex-direction:\s*column/);
    expect(body).toMatch(/overflow-y:\s*auto/);
  });

  it('its children keep their natural height rather than shrinking', () => {
    expect(ruleBody('.workshop-view > *')).toMatch(/flex:\s*0\s+0\s+auto/);
  });
});
