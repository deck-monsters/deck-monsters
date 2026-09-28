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

/** `--font-size` 14px × `--line-height` 1.4, on `.event` and `.event-card-block`. */
const LINE_PX = 19.6;
/** `.event` padding: `--event-spacing` (0.4rem) on both sides, at a 16px root. */
const ROW_CHROME_PX = 12.8;
/**
 * `.event-card-block`: 0.5rem padding, 0.4rem margin, 1px border, each on both sides.
 * The ``` fence becomes that panel.
 */
const CARD_BLOCK_CHROME_PX = 30.8;
/**
 * JetBrains Mono at 14px is 8.4px wide. `RingPane` divides the feed's content box by
 * this. Below a card frame (34 columns) a phone still wraps prose the same way the
 * estimate does; a wider guess books a wrapped line as one and the anchor yanks
 * `scrollTop` back toward newer events.
 */
export const FEED_CHAR_PX = 8.4;
/** Used until the feed has a width. Wide enough that a 34-column frame stays one line. */
export const FEED_WRAP_COLUMNS_FALLBACK = 48;

export function feedWrapColumns(contentWidthPx: number): number {
  if (!(contentWidthPx > 0)) return FEED_WRAP_COLUMNS_FALLBACK;
  return Math.max(16, Math.floor(contentWidthPx / FEED_CHAR_PX));
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
): number {
  const body = text ?? '';
  if (body.length === 0) return ROW_CHROME_PX + LINE_PX;

  const parts = body.split('```');
  let height = ROW_CHROME_PX;
  parts.forEach((part, index) => {
    if (!part) return;
    height += visualLines(part, wrapColumns) * LINE_PX;
    // Odd segments are the fenced card panel.
    if (index % 2 === 1) height += CARD_BLOCK_CHROME_PX;
  });
  return height;
}
