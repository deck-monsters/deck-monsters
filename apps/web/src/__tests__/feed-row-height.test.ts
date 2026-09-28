import { describe, expect, it } from 'vitest';
import { estimateFeedRowHeight, feedWrapColumns } from '../utils/feed-row-height.js';

const narration = 'one short narration line';
const card = [
  'lays down the following card:',
  '```',
  '==================================',
  ' title',
  '----------------------------------',
  ...Array.from({ length: 8 }, () => ' a line of the card'),
  '==================================',
  '```',
].join('\n');

describe('estimateFeedRowHeight', () => {
  it('books a fenced card box far taller than a one-line narration', () => {
    expect(estimateFeedRowHeight(card)).toBeGreaterThan(estimateFeedRowHeight(narration) * 4);
  });

  it('counts a blank line, so a card frame does not collapse', () => {
    expect(estimateFeedRowHeight('a\n\nb')).toBeGreaterThan(estimateFeedRowHeight('a\nb'));
  });

  it('matches a mounted card row at the feed line box', () => {
    // Measured on the ring (14px, line-height 1.4, content width 608px → 72 columns):
    // the row was 298.3px. A 22px line booked this same frame ~12% tall, and measuring
    // it still moved the viewport.
    const text = [
      '💪 Chuvvo lays down the following card:',
      '',
      '```',
      '==================================',
      ' 🐂  Horn Gore  ☆',
      '----------------------------------',
      '',
      ' You think those horns are just ',
      ' there to look pretty? Think ',
      ' again...',
      '',
      '==================================',
      '```',
      '',
    ].join('\n');
    expect(estimateFeedRowHeight(text, 72)).toBeCloseTo(298.4, 1);
  });

  it('turns the feed content width into wrap columns', () => {
    expect(feedWrapColumns(608)).toBe(72);
    expect(feedWrapColumns(0)).toBeGreaterThanOrEqual(34);
  });

  it('adds the card-panel chrome the fence becomes', () => {
    const inside = '==================================\n title\n==================================';
    expect(estimateFeedRowHeight(`before\n\`\`\`\n${inside}\n\`\`\``)).toBeGreaterThan(
      estimateFeedRowHeight(`before\n${inside}`),
    );
  });
});
