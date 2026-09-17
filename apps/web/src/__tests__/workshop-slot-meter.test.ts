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

describe('slot meter label is readable (#120)', () => {
  // The label used to be `position: absolute; inset: 0` over the accent-coloured fill,
  // which measures 1.02:1 in phosphor, 1.14:1 in ember and 1.65:1 in amber — two light
  // pastels on each other. It failed hardest at a full deck, where the fill covers the
  // whole label, which is exactly when a player most wants to read it. No single colour
  // can sit readably on a fill whose width changes, so the label moved off the bar.
  it('does not stack the label on top of the fill', () => {
    const body = ruleBody('.workshop-slot-meter > span');
    expect(body).not.toMatch(/position:\s*absolute/);
    expect(body).not.toMatch(/inset:/);
  });

  it('keeps the fill in its own track, away from the text', () => {
    expect(ruleBody('.workshop-slot-meter-track > div')).toMatch(/background:\s*var\(--color-accent\)/);
    expect(ruleBody('.workshop-slot-meter > span')).not.toMatch(/background/);
  });

  it('lays the meter out as label-beside-bar', () => {
    const body = ruleBody('.workshop-slot-meter');
    expect(body).toMatch(/display:\s*flex/);
    expect(body).not.toMatch(/position:\s*relative/);
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
