import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const baseCss = readFileSync(join(process.cwd(), 'src/styles/base.css'), 'utf8');
const terminalCss = readFileSync(join(process.cwd(), 'src/styles/terminal.css'), 'utf8');

function ruleBody(css: string, selector: string): string {
  const match = css.match(
    new RegExp(`(^|\\})\\s*${selector.replace(/[.*]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`, 'm')
  );
  expect(match, `expected a \`${selector}\` rule`).toBeTruthy();
  return match![2]!;
}

describe('.workshop-header-actions is an explicit flex row (10-bug-fixes.md #6)', () => {
  // This class used to get `display: flex` only by riding along on terminal.css's
  // `.pane-header-actions` selector — base.css's own copy carried just `flex: 0 0 auto`
  // (its sizing as a flex *item*, not container-ness) plus a comment insisting it was "not
  // a flex container". Nobody noticed the cross-file coupling actually made it one, so the
  // mobile `justify-content`/`flex-wrap` override a few lines below was reported as dead
  // CSS (10-bug-fixes.md #6) even though it was quietly working. Fixed by declaring the
  // container-ness once, directly on this class, in the same file as its mobile override.
  it('is declared as a flex container in base.css, where its mobile override lives', () => {
    const body = ruleBody(baseCss, '.workshop-header-actions');
    expect(body).toMatch(/display:\s*flex/);
  });

  it('is no longer coupled to `.pane-header-actions` in terminal.css', () => {
    // A future edit to the pane-header selector list must not be able to silently break
    // the Workshop header's flex layout again.
    expect(terminalCss).not.toMatch(/\.workshop-header-actions\s*\{/);
  });

  it('the phone-width override has a flex row to act on', () => {
    const narrow = baseCss.slice(baseCss.indexOf('@container workshop (max-width: 520px)'));
    expect(ruleBody(narrow, '.workshop-header-actions')).toMatch(/flex-wrap:\s*wrap/);
  });

  // Bug 210: once coins, Sync and Train monster left the header, a stacked header put the
  // pane's lone ⤢ link on a line of its own. The header stays a row at phone width.
  it('keeps the header a row at phone width', () => {
    const narrow = baseCss.slice(baseCss.indexOf('@container workshop (max-width: 520px)'));
    expect(ruleBody(narrow, '.workshop-header')).not.toMatch(/flex-direction:\s*column/);
  });

  it('gives the Train row a flex row that stacks at phone width', () => {
    expect(ruleBody(baseCss, '.workshop-train-row')).toMatch(/display:\s*flex/);
    const narrow = baseCss.slice(baseCss.indexOf('@container workshop (max-width: 520px)'));
    expect(ruleBody(narrow, '.workshop-train-row')).toMatch(/flex-direction:\s*column/);
  });

  // Bug 210: in the stacked column the desktop `flex: 1 1 12rem` basis became a 12rem
  // height, leaving a screen-high gap above the button.
  it('gives the Train sentence its natural height when the row stacks', () => {
    const narrow = baseCss.slice(baseCss.indexOf('@container workshop (max-width: 520px)'));
    expect(ruleBody(narrow, '.workshop-train-line')).toMatch(/flex:\s*0 0 auto/);
  });
});
