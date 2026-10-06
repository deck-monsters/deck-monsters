/**
 * Pixel guess for an unmeasured ring-feed row.
 *
 * Virtuoso otherwise books every unmeasured row at the first row it rendered, which is
 * usually a one-line narration. A card box is a fenced frame tens of lines tall. Scrolling
 * up into history mounts those frames, the size tree grows by thousands of pixels, and
 * Virtuoso's anchor correction moves `scrollTop` back toward newer events (10b #196).
 * The measured height replaces this guess once the row mounts. Do not re-pin from it:
 * #159 scrolls the scroller element's own `scrollHeight`, because a guess that is still
 * short lands the follow snap above the newest line.
 *
 * The numbers are the CSS boxes, not a rounded-up line. A 22px line (14×1.4, rounded up)
 * booked every row about 12% tall. Measuring then shrank `scrollHeight` (47070 → 41839
 * on Test Room A) and the same anchor correction carried the viewport further up than
 * the wheel had moved. Matching the line box keeps that correction near zero.
 */

/**
 * The type and chrome the estimate multiplies. A theme sets its own feed type through the
 * `--feed-*` tokens (terminal.css `.event-feed`), so these are read from the live CSS by
 * `readFeedMetrics` rather than assumed. The defaults below are what the four dark themes
 * draw (and what jsdom, which has no layout, falls back to); `feed-row-height.test.ts`
 * pins them, because a drift here moves every dark theme's scroll-back (10b #196).
 *
 * - `linePx`: `--feed-font-size` 14px × `--feed-line-height` 1.4, on `.event` and
 *   `.event-card-block`.
 * - `charPx`: JetBrains Mono's 0.6em advance at 14px (plus `--feed-letter-spacing`).
 *   `RingPane` divides the feed's content box by it. Below a card frame (34 columns) a
 *   phone still wraps prose the same way the estimate does; a wider guess books a wrapped
 *   line as one and the anchor yanks `scrollTop` back toward newer events.
 * - `rowChromePx`: `.event` padding, `--event-spacing` (0.4rem) on both sides at a 16px root.
 * - `cardChromePx`: `.event-card-block`, 0.5rem padding, 0.4rem margin, 1px border, each on
 *   both sides. The ``` fence becomes that panel.
 * - `gutterPx`: `.event-feed-list` horizontal padding (`--pane-padding` on both sides), what
 *   `RingPane` subtracts from the scroller's width to get the text's content box.
 */
export interface FeedMetrics {
  linePx: number;
  charPx: number;
  rowChromePx: number;
  cardChromePx: number;
  gutterPx: number;
}

export const DEFAULT_FEED_METRICS: FeedMetrics = {
  linePx: 19.6,
  charPx: 8.4,
  rowChromePx: 12.8,
  cardChromePx: 30.8,
  gutterPx: 24,
};

/** Kept for callers that only want the default advance. */
export const FEED_CHAR_PX = DEFAULT_FEED_METRICS.charPx;
/** Used until the feed has a width. Wide enough that a 34-column frame stays one line. */
export const FEED_WRAP_COLUMNS_FALLBACK = 48;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Reads the feed's real line box, glyph advance and chrome by mounting a hidden copy of one
 * row inside `host` (the feed itself may be unmounted: a theme switch unmounts the list so
 * Virtuoso re-reads its estimates). Going through the stylesheet means a theme only has to
 * set `--feed-*`; nothing here knows which theme is active. Each value falls back to the
 * default when the browser reports nothing (jsdom, `display: none`). Values are rounded to
 * 0.01px so a 1/64px layout rounding cannot make a dark theme's numbers differ from the
 * constants.
 */
export function readFeedMetrics(host: HTMLElement | null): FeedMetrics {
  if (!host || typeof getComputedStyle !== 'function') return DEFAULT_FEED_METRICS;
  const probe = document.createElement('div');
  probe.className = 'event-feed';
  probe.setAttribute('aria-hidden', 'true');
  // Out of flow and invisible, but laid out (display: none would measure nothing).
  probe.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;width:1000px;height:auto;overflow:visible;flex:none';
  const COUNT = 40;
  const SCALE = 10;
  probe.innerHTML =
    '<ol class="event-feed-list"><li class="event"><span data-probe="char" style="white-space:pre"></span>' +
    '<div class="event-card-block"></div></li></ol>';
  const list = probe.querySelector<HTMLElement>('.event-feed-list');
  const row = probe.querySelector<HTMLElement>('.event');
  const span = probe.querySelector<HTMLElement>('[data-probe="char"]');
  const card = probe.querySelector<HTMLElement>('.event-card-block');
  if (!list || !row || !span || !card) return DEFAULT_FEED_METRICS;
  span.textContent = '0'.repeat(COUNT);
  host.appendChild(probe);
  try {
    const px = (value: string) => parseFloat(value) || 0;
    const rowStyle = getComputedStyle(row);
    const cardStyle = getComputedStyle(card);
    const line = px(rowStyle.lineHeight);
    // No stylesheet or no layout (jsdom): every padding reads 0 too, so take the defaults
    // whole rather than mixing them with zeros. A real theme with 0 padding has a line.
    if (!(line > 0)) return DEFAULT_FEED_METRICS;
    // Measure at 10x the size and divide. Some platforms (headless Linux Chrome, without
    // subpixel text positioning) round every glyph advance to a whole pixel at the real size:
    // 14px JetBrains Mono came out at 8px, not 8.4, and 12.5px at 8px, not 7.5. The estimate
    // models the font's design advance (0.6em); at 10x the rounding error is a tenth as big.
    const spanStyle = getComputedStyle(span);
    span.style.fontSize = `${px(spanStyle.fontSize) * SCALE}px`;
    span.style.letterSpacing = `${px(spanStyle.letterSpacing) * SCALE}px`;
    const width = span.getBoundingClientRect().width / SCALE;
    const rowChrome = px(rowStyle.paddingTop) + px(rowStyle.paddingBottom);
    const listStyle = getComputedStyle(list);
    const gutter = px(listStyle.paddingLeft) + px(listStyle.paddingRight);
    const cardChrome =
      px(cardStyle.paddingTop) +
      px(cardStyle.paddingBottom) +
      px(cardStyle.marginTop) +
      px(cardStyle.marginBottom) +
      px(cardStyle.borderTopWidth) +
      px(cardStyle.borderBottomWidth);
    return {
      linePx: round2(line),
      charPx: width > 0 ? round2(width / COUNT) : DEFAULT_FEED_METRICS.charPx,
      rowChromePx: round2(rowChrome),
      cardChromePx: cardChrome > 0 ? round2(cardChrome) : DEFAULT_FEED_METRICS.cardChromePx,
      gutterPx: round2(gutter),
    };
  } finally {
    probe.remove();
  }
}

export function feedWrapColumns(
  contentWidthPx: number,
  metrics: FeedMetrics = DEFAULT_FEED_METRICS,
): number {
  if (!(contentWidthPx > 0)) return FEED_WRAP_COLUMNS_FALLBACK;
  return Math.max(16, Math.floor(contentWidthPx / metrics.charPx));
}

function visualLines(segment: string, wrapColumns: number): number {
  if (segment.length === 0) return 0;
  const segments = segment.split('\n');
  // A trailing newline is the break that ended the last line, not another blank row.
  // An interior blank line (`\n\n`) stays. Checked against mounted ring rows: counting
  // the trailing break booked every such row one line tall and the anchor still moved.
  const lines =
    segments.length > 1 && segments[segments.length - 1] === ''
      ? segments.slice(0, -1)
      : segments;
  let count = 0;
  for (const line of lines) {
    count += Math.ceil(Math.max(line.length, 1) / wrapColumns);
  }
  return count;
}

export function estimateFeedRowHeight(
  text: string | undefined,
  wrapColumns: number = FEED_WRAP_COLUMNS_FALLBACK,
  metrics: FeedMetrics = DEFAULT_FEED_METRICS,
): number {
  const { linePx, rowChromePx, cardChromePx } = metrics;
  const body = text ?? '';
  if (body.length === 0) return rowChromePx + linePx;

  const parts = body.split('```');
  let height = rowChromePx;
  parts.forEach((part, index) => {
    if (!part) return;
    height += visualLines(part, wrapColumns) * linePx;
    // Odd segments are the fenced card panel.
    if (index % 2 === 1) height += cardChromePx;
  });
  return height;
}
