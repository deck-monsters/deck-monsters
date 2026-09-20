import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const css = readFileSync(join(process.cwd(), 'src/styles/base.css'), 'utf8');

function ruleBody(selector: string): string {
  const match = css.match(
    new RegExp(`(^|\\})\\s*${selector.replace(/[.*]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`, 'm')
  );
  expect(match, `expected a \`${selector}\` rule in base.css`).toBeTruthy();
  return match![2]!;
}

describe('hp meter label is readable, the same lesson as the removed slot meter (#120)', () => {
  // The deck-slot meter this file used to cover was removed entirely in favour of an HP
  // meter (10b-bugs-fixed.md — the header hid current HP behind a bar that was nearly
  // always full). The HP meter is the new primary meter and inherits the same risk #120
  // fixed: the label used to sit `position: absolute; inset: 0` over the fill, which
  // measured 1.02:1 in phosphor, 1.14:1 in ember, 1.65:1 in amber — unreadable, worst at a
  // full bar. No single colour can sit readably on a fill whose width changes, so the
  // label stays beside the track rather than on it.
  it('does not stack the label on top of the fill', () => {
    const body = ruleBody('.workshop-hp-meter > span');
    expect(body).not.toMatch(/position:\s*absolute/);
    expect(body).not.toMatch(/inset:/);
  });

  it('lays the meter out as label-beside-bar', () => {
    const body = ruleBody('.workshop-hp-meter');
    expect(body).toMatch(/display:\s*flex/);
    expect(body).not.toMatch(/position:\s*relative/);
  });

  // Regression guard: nothing should resurrect the removed deck-slot bar's CSS once its
  // JSX is gone — dead CSS for a role/label that no longer exists in the DOM is exactly
  // the kind of drift AGENTS.md asks to fix on sight, not just skip touching.
  it('does not still define the removed deck-slot meter', () => {
    expect(css).not.toMatch(/\.workshop-slot-meter\b/);
  });
});

describe('card grids match density across the workshop (#121)', () => {
  // The inventory's cards are dragged onto the monster panel's slots, so the same card
  // appearing at two noticeably different sizes on one screen reads as a rendering fault.
  it('the inventory grid is 3-up at phone width, like the slot grid above it', () => {
    const narrow = css.slice(css.indexOf('@container workshop (max-width: 520px)'));
    expect(narrow).toMatch(/\.workshop-card-grid\s*\{\s*grid-template-columns:\s*repeat\(3,/);
  });

  it('the slot grid reflows rather than overflowing in a very narrow pane', () => {
    const narrowest = css.slice(css.indexOf('@container workshop (max-width: 280px)'));
    expect(narrowest).toMatch(/\.workshop-slot-grid\s*\{\s*grid-template-columns:\s*repeat\(2,/);
  });
});
