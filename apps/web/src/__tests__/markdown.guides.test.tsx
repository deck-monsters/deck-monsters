import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import handbook from '../../../../PLAYER_HANDBOOK.md?raw';
import monsters from '../../../../MONSTERS.md?raw';
import cards from '../../../../CARDS.md?raw';
import items from '../../../../ITEMS.md?raw';
import { renderMarkdown, stripGeneratedNotice } from '../lib/markdown.js';

const GUIDES = { handbook, monsters, cards, items };

describe.each(Object.entries(GUIDES))('real guide: %s', (_name, source) => {
  const text = stripGeneratedNotice(source);
  const { container } = render(<>{renderMarkdown(text)}</>);
  // Measured at collection time: RTL unmounts after each test, detaching `container`.
  const tableCount = container.querySelectorAll('table').length;
  const regionsWithTable = [...container.querySelectorAll('.help-table-region')].every((r) => r.querySelector('table'));
  const ids = new Set([...container.querySelectorAll('[id]')].map((e) => e.id));
  const anchors = [...container.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')!.slice(1));
  // Code blocks legitimately contain any characters; check prose elements only.
  const prose = [...container.querySelectorAll('p, li, td, th, h2, h3, h4, h5, h6, blockquote')]
    .map((el) => el.textContent ?? '');

  it('leaves no raw Markdown in rendered prose', () => {
    for (const t of prose) {
      expect(t).not.toContain('**');
      expect(t).not.toContain('](');
      expect(t).not.toContain('|---');
      expect(t).not.toMatch(/^#{1,6}\s/);
    }
  });

  it('renders every table as a table', () => {
    const sources = text.split('\n').filter((l, i, a) => /^\s*\|?\s*:?-{3,}/.test(l) && l.includes('|') && /^\s*\|/.test(a[i - 1] ?? ''));
    expect(tableCount).toBe(sources.length);
    expect(regionsWithTable).toBe(true);
  });

  it('resolves every in-page anchor to a heading id', () => {
    for (const id of anchors) expect(ids.has(id)).toBe(true);
  });
});
