import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_FEED_METRICS,
  FEED_CHAR_PX,
  estimateFeedRowHeight,
  feedWrapColumns,
  readFeedMetrics,
  type FeedMetrics,
} from '../utils/feed-row-height.js';

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

// The old hard-coded numbers. The four dark themes must keep drawing and booking exactly these.
describe('feed metrics', () => {
  it('defaults equal the constants the estimate used before it read the CSS', () => {
    expect(DEFAULT_FEED_METRICS.linePx).toBeCloseTo(14 * 1.4, 10);
    expect(DEFAULT_FEED_METRICS.charPx).toBeCloseTo(14 * 0.6, 10);
    expect(DEFAULT_FEED_METRICS.rowChromePx).toBeCloseTo(0.4 * 16 * 2, 10);
    expect(DEFAULT_FEED_METRICS.cardChromePx).toBeCloseTo(0.5 * 16 * 2 + 0.4 * 16 * 2 + 2, 10);
    expect(DEFAULT_FEED_METRICS.gutterPx).toBe(24);
    expect(FEED_CHAR_PX).toBe(8.4);
    expect(estimateFeedRowHeight('')).toBeCloseTo(32.4, 5);
  });

  it('passing the default metrics explicitly changes nothing', () => {
    for (const text of [narration, card, 'a\n\nb', '']) {
      expect(estimateFeedRowHeight(text, 40, DEFAULT_FEED_METRICS)).toBe(
        estimateFeedRowHeight(text, 40),
      );
    }
  });

  it('falls back to a copy of the defaults where there is no layout (jsdom)', () => {
    const read = readFeedMetrics(document.body);
    expect(read).toEqual(DEFAULT_FEED_METRICS);
    expect(read).not.toBe(DEFAULT_FEED_METRICS);
    expect(readFeedMetrics(null)).not.toBe(DEFAULT_FEED_METRICS);
    expect(document.querySelector('.event-feed')).toBeNull();
    expect(Object.isFrozen(DEFAULT_FEED_METRICS)).toBe(true);
  });

  describe('readFeedMetrics with layout', () => {
    // jsdom has no layout: stub the two boxes the reader measures, keep real computed styles.
    let style: HTMLStyleElement;
    let rectSpy: ReturnType<typeof vi.spyOn>;
    function stubLayout(charRun: number, lineBlock: number) {
      rectSpy = vi
        .spyOn(Element.prototype, 'getBoundingClientRect')
        .mockImplementation(function (this: Element) {
          const kind = this.getAttribute('data-probe');
          const box = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) };
          if (kind === 'char') return { ...box, width: charRun, height: 10 } as DOMRect;
          if (kind === 'lines') return { ...box, width: 50, height: lineBlock } as DOMRect;
          return { ...box, width: 0, height: 0 } as DOMRect;
        });
    }
    beforeEach(() => {
      style = document.createElement('style');
      style.textContent =
        '.event{padding:3px 0}.event-card-block{padding:0;margin:0;border:0}.event-feed-list{padding:5px 7px}';
      document.head.appendChild(style);
    });
    afterEach(() => {
      style.remove();
      rectSpy?.mockRestore();
    });

    it('divides the long run and the line block, and trusts zero card chrome', () => {
      stubLayout(1600, 61.875); // 200 chars at 8px (a platform with whole-pixel advances)
      const host = document.createElement('div');
      document.body.appendChild(host);
      const read = readFeedMetrics(host);
      expect(read).toEqual({ linePx: 20.63, charPx: 8, rowChromePx: 6, cardChromePx: 0, gutterPx: 14, lineGapPx: 0, dividerChromePx: 0 });
      // The probe is gone, whatever it measured.
      expect(host.children).toHaveLength(0);
      host.remove();
    });

    it('removes the probe when a measurement throws', () => {
      stubLayout(1600, 60);
      const host = document.createElement('div');
      document.body.appendChild(host);
      vi.spyOn(window, 'getComputedStyle').mockImplementationOnce(() => {
        throw new Error('boom');
      });
      expect(() => readFeedMetrics(host)).toThrow('boom');
      expect(host.children).toHaveLength(0);
      host.remove();
      vi.restoreAllMocks();
    });
  });

  // Millefleur: JetBrains Mono 12.5px on a 1.65 line (theme-millefleur.css, from ring.html).
  const millefleur: FeedMetrics = {
    linePx: 12.5 * 1.65,
    charPx: 12.5 * 0.6,
    rowChromePx: 12.8,
    cardChromePx: 30.8,
    gutterPx: 24,
    lineGapPx: 2,
    dividerChromePx: 12.8,
  };

  it('books Millefleur at a 20.625px line and a 7.5px advance', () => {
    expect(millefleur.linePx).toBeCloseTo(20.625, 5);
    expect(millefleur.charPx).toBeCloseTo(7.5, 5);
    expect(estimateFeedRowHeight('one line', 48, millefleur)).toBeCloseTo(12.8 + 20.625, 5);
    expect(estimateFeedRowHeight('x'.repeat(100), 48, millefleur)).toBeCloseTo(
      12.8 + 3 * 20.625,
      5,
    );
  });

  it('wraps at the Millefleur advance: a 342px phone column is 45 columns, not 40', () => {
    expect(feedWrapColumns(342, millefleur)).toBe(45);
    expect(feedWrapColumns(342)).toBe(40);
    // A 34-column card frame still fits one line on that column.
    expect(feedWrapColumns(342, millefleur)).toBeGreaterThanOrEqual(34);
  });

  it('books a Millefleur card block from its own line and chrome', () => {
    const text = 'before\n```\n==========\n title\n==========\n```';
    // 1 narration line + 4 card lines (the blank after the fence counts), one row padding and one card panel.
    expect(estimateFeedRowHeight(text, 45, millefleur)).toBeCloseTo(
      12.8 + 30.8 + 5 * 20.625,
      5,
    );
  });
});
