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

export const DEFAULT_FEED_METRICS: Readonly<FeedMetrics> = Object.freeze({
  linePx: 19.6,
  charPx: 8.4,
  rowChromePx: 12.8,
  cardChromePx: 30.8,
  gutterPx: 24,
});

/** Kept for callers that only want the default advance. */
export const FEED_CHAR_PX = DEFAULT_FEED_METRICS.charPx;
/** Used until the feed has a width. Wide enough that a 34-column frame stays one line. */
export const FEED_WRAP_COLUMNS_FALLBACK = 48;

const round2 = (n: number) => Math.round(n * 100) / 100;
/** A fresh object: callers keep metrics in state and must not be able to mutate the defaults. */
const defaults = (): FeedMetrics => ({ ...DEFAULT_FEED_METRICS });

/** Characters in the advance probe. Long, so a platform's whole-pixel rounding averages in. */
const CHAR_RUN = 200;
const LINE_RUN = 3;
/** Tolerance for treating the computed and rendered line as the same: a few 1/64px units. */
const LINE_SNAP_PX = 0.05;

/**
 * Reads the feed's real line box, glyph advance and chrome by mounting a hidden copy of one
 * row inside `host` (the feed itself may be unmounted, or hidden in another pane slot).
 * Going through the stylesheet means a theme only has to set `--feed-*`; nothing here knows
 * which theme is active.
 *
 * Both the advance and the line box are what the browser lays out, not what the font or the
 * CSS promises. The advance is a 200-character run measured at the real size and divided, so
 * a platform that rounds each glyph to a whole pixel (headless Linux Chrome: 12.5px JetBrains
 * Mono draws 8px, not 7.5) is counted as it is drawn. Assuming the design 0.6em there books
 * 45 columns where 42 fit, i.e. under-counts wrapped lines, which is the direction 10b #196
 * warns about. The line is the height of a three-line block over three, which also covers
 * `line-height: normal`. The advance is the resolved font's: if JetBrains Mono has not loaded
 * yet the fallback's advance is read, so callers re-read after `document.fonts` settles.
 *
 * Returns the defaults (a copy) only when there is no layout at all (jsdom, `display: none`).
 * Values are rounded to 0.01px so 1/64px layout units cannot make a dark theme differ from
 * the constants.
 */
export function readFeedMetrics(host: HTMLElement | null): FeedMetrics {
  if (!host || typeof getComputedStyle !== 'function') return defaults();
  const probe = document.createElement('div');
  probe.className = 'event-feed';
  probe.setAttribute('aria-hidden', 'true');
  // Out of flow and invisible, but laid out (display: none would measure nothing). Clipped
  // to the host's width so it cannot widen an ancestor's scrollable overflow; the run is
  // `white-space: pre`, so clipping does not change its measured width.
  probe.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;width:100%;height:auto;overflow:hidden;flex:none';
  probe.innerHTML =
    '<ol class="event-feed-list"><li class="event">' +
    '<span data-probe="char" style="white-space:pre"></span>' +
    '<div data-probe="lines" style="white-space:pre"></div>' +
    '<div class="event-card-block"></div></li></ol>';
  const list = probe.querySelector<HTMLElement>('.event-feed-list');
  const row = probe.querySelector<HTMLElement>('.event');
  const span = probe.querySelector<HTMLElement>('[data-probe="char"]');
  const lines = probe.querySelector<HTMLElement>('[data-probe="lines"]');
  const card = probe.querySelector<HTMLElement>('.event-card-block');
  if (!list || !row || !span || !lines || !card) return defaults();
  span.textContent = '0'.repeat(CHAR_RUN);
  lines.textContent = Array.from({ length: LINE_RUN }, () => '0').join('\n');
  host.appendChild(probe);
  try {
    const px = (value: string) => parseFloat(value) || 0;
    const width = span.getBoundingClientRect().width;
    const height = lines.getBoundingClientRect().height;
    // No stylesheet or no layout (jsdom, a hidden pane): nothing measures, so take the
    // defaults whole rather than mixing them with zeros.
    if (!(width > 0) || !(height > 0)) return defaults();
    const rowStyle = getComputedStyle(row);
    // Layout snaps each line box to 1/64px (19.6 draws as 19.59375), so a rendered 19.59 would
    // differ from the CSS's 19.6 for no visible reason. Take the CSS value when the layout
    // agrees with it, and the layout when it does not (`line-height: normal`, a taller
    // fallback font).
    const computedLine = parseFloat(rowStyle.lineHeight) || 0;
    const rendered = height / LINE_RUN;
    const cardStyle = getComputedStyle(card);
    const listStyle = getComputedStyle(list);
    // Zero chrome is a real answer once the line has measured (a theme may draw a card with
    // no padding, margin or border).
    return {
      linePx: round2(Math.abs(computedLine - rendered) <= LINE_SNAP_PX ? computedLine : rendered),
      charPx: round2(width / CHAR_RUN),
      rowChromePx: round2(px(rowStyle.paddingTop) + px(rowStyle.paddingBottom)),
      cardChromePx: round2(
        px(cardStyle.paddingTop) +
          px(cardStyle.paddingBottom) +
          px(cardStyle.marginTop) +
          px(cardStyle.marginBottom) +
          px(cardStyle.borderTopWidth) +
          px(cardStyle.borderBottomWidth),
      ),
      gutterPx: round2(px(listStyle.paddingLeft) + px(listStyle.paddingRight)),
    };
  } finally {
    probe.remove();
  }
}

export function feedWrapColumns(
  contentWidthPx: number,
  metrics: Readonly<FeedMetrics> = DEFAULT_FEED_METRICS,
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
  metrics: Readonly<FeedMetrics> = DEFAULT_FEED_METRICS,
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
