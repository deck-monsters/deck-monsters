import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const css = readFileSync(join(process.cwd(), 'src/styles/terminal.css'), 'utf8');

/** Pull one rule body out of the stylesheet by selector. */
function ruleBody(selector: string): string {
  const match = css.match(
    new RegExp(`(^|\\})\\s*${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`, 'm')
  );
  expect(match, `expected a \`${selector}\` rule in terminal.css`).toBeTruthy();
  return match![2]!;
}

describe('feed layout: padding sits on the list, not the scroller (#98)', () => {
  // `.event-feed` is the scroller. The gutters live on `.event-feed-list` inside it. (The
  // virtual list this was written for needed it because its viewport resolved
  // `width: 100%` against the padding box; the plain list keeps the rule so the scroller's
  // clientWidth, which the feed's pinning reads, stays the visible width.)
  it('.event-feed declares no padding', () => {
    expect(ruleBody('.event-feed')).not.toMatch(/(^|[\s;])padding/);
  });

  it('.event-feed still clips horizontally, so a regression would be invisible', () => {
    // This is why the bug was silent rather than producing a scrollbar. If this ever
    // changes, the padding rule above matters less — but the feed would scroll
    // sideways on a phone instead, which is its own bug.
    expect(ruleBody('.event-feed')).toMatch(/overflow-x:\s*hidden/);
  });

  it('.event-feed-list carries the gutters instead', () => {
    expect(ruleBody('.event-feed-list')).toMatch(/padding:\s*var\(--pane-padding\)/);
  });

  it('.event-feed-empty carries them too, since it renders outside the list', () => {
    expect(ruleBody('.event-feed-empty')).toMatch(/padding:\s*var\(--pane-padding\)/);
  });
});
