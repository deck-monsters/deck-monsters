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
    const mobileBody = ruleBody(narrow, '.workshop-header-actions');
    expect(mobileBody).toMatch(/justify-content:\s*space-between/);
    expect(mobileBody).toMatch(/flex-wrap:\s*wrap/);
  });

  it('the wallet no longer double-spaces itself with a margin on top of the row gap', () => {
    // `margin-right` here used to be the *only* spacing mechanism (chosen while the author
    // believed the parent's `gap` did nothing); once the parent really is a flex row, the
    // margin stacked with the gap and doubled the visible space after the wallet.
    expect(ruleBody(baseCss, '.workshop-wallet')).not.toMatch(/margin-right/);
  });
});
