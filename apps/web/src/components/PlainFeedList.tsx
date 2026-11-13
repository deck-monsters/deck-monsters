import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { feedTimings } from '../lib/feed-timings.js';

/**
 * A feed as a plain list: every row in the window is in the DOM, the browser scrolls it, and
 * following the bottom is one rule. Roadmap 52's spike C1, the only feed list since D3 (the
 * `react-virtuoso` list, its height guesses and `useFeedAutoScroll` were deleted then; why: 10b #271).
 *
 * Why not a virtual list. A virtual list does not know a row's height until it has drawn it,
 * and feed rows run from one line to a card frame. `react-virtuoso` needed a height
 * guess per row, a remount whenever a theme changed the guess,
 * and a heuristic to tell "the reader scrolled" from "the bottom moved" (`useFeedAutoScroll`).
 * The baseline (docs/reference/feed-stability-baseline.md) traces S1 to S7 to those. Here
 * every height is real, so none of it is needed. The price is DOM size, bounded by `cap`: the
 * Ring's history is at most 500 rows and one fight adds a few hundred.
 *
 * The rules:
 *  - Pinned (the default): after anything changes the content's or the viewport's size, scroll
 *    to the end, before paint. Appends, late fonts, the roster growing: one path.
 *  - The reader unpins only by moving up: a scroll event whose `scrollTop` is lower than the
 *    last one seen, ending more than `PIN_THRESHOLD_PX` from the end, while the content and
 *    the viewport are the size they were when last looked at. Growth never lowers
 *    `scrollTop`; a reflow can (content shrinks, the browser clamps, the scroll event arrives
 *    a frame later, after the content has grown again), and a reflow changes a size. A
 *    reader's scroll does not. No timers.
 *  - Unpinned: nothing scrolls. If content above the viewport changes height (a theme switch,
 *    a rotation), the row the reader was on is put back where it was. This is done here, not
 *    left to CSS scroll anchoring, because iOS Safari has none.
 *  - Reaching the end again pins.
 *  - Rows are trimmed to `cap` only while pinned, when the reader cannot see the top go.
 *  - The first paint draws only the newest `FIRST_PAINT_ROWS`; older rows are added above in
 *    idle time. Drawing 500 rows at once took 1.5 to 2.1 s on a phone-speed CPU (4 to 6 times
 *    throttled Chromium) against 1.1 s for the virtual list; the reader only sees the end.
 */

/** Pixels from the end that still count as at the end. Absorbs fractional layout. */
export const PIN_THRESHOLD_PX = 8;
/** Rows kept in the DOM while following. */
export const DEFAULT_FEED_CAP = 1000;
/** Rows drawn on the first paint, and added above per idle slice after it. */
const FIRST_PAINT_ROWS = 24;
const BACKFILL_ROWS = 40;
/** A jump to the end is held until the feed is quiet this long, at most the limit (`holdEnd`). */
const JUMP_QUIET_MS = 400;
const JUMP_LIMIT_MS = 4_000;
/** While reading back nothing is trimmed, up to this many times the cap. */
const UNPINNED_CAP_FACTOR = 3;

export interface PlainFeedHandle {
  /** Go to the newest row and follow again. */
  scrollToBottom(): void;
  isPinned(): boolean;
}

interface RowProps<T> {
  item: T;
  index: number;
  /** A per-row input that is not part of `item` (for the Ring: "may claim its mechanic note"). */
  flag: boolean;
  /** Changes when anything else the renderer reads has changed. */
  version: unknown;
  render: (index: number, item: T) => ReactNode;
}

function RowImpl<T>({ item, index, render }: RowProps<T>) {
  // `data-item-index` is what the feed's CSS and the browser suite's selectors key on.
  return (
    <div data-index={index} data-item-index={index}>
      {render(index, item)}
    </div>
  );
}
// `render` closes over the pane's state and is new on every render; `version` and `flag` say
// when its output for an unchanged item could differ.
const Row = memo(
  RowImpl,
  (a, b) => a.item === b.item && a.index === b.index && a.flag === b.flag && a.version === b.version,
) as typeof RowImpl;

export interface PlainFeedListProps<T> {
  data: readonly T[];
  rowKey: (item: T, index: number) => string;
  renderRow: (index: number, item: T) => ReactNode;
  rowFlag?: (item: T) => boolean;
  rowVersion?: unknown;
  empty: ReactNode;
  /** Prefix for `feed-timings` counters: `ring` or `console`. */
  pane: string;
  ariaLabel: string;
  cap?: number;
  onPinnedChange?: (pinned: boolean) => void;
}

function PlainFeedListInner<T>(
  { data, rowKey, renderRow, rowFlag, rowVersion, empty, pane, ariaLabel, cap = DEFAULT_FEED_CAP, onPinnedChange }: PlainFeedListProps<T>,
  ref: React.ForwardedRef<PlainFeedHandle>,
) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const pinnedRef = useRef(true);
  const lastTopRef = useRef(0);
  // The sizes when last looked at. A scroll event that finds them changed was caused by a
  // reflow, not by the reader (see the rules above).
  const lastSizeRef = useRef({ content: 0, viewport: 0 });
  const startRef = useRef(0);
  // Until this time (ms, performance.now) a jump to the end is being held: see `scrollToBottom`.
  const jumpUntilRef = useRef(0);
  const jumpFrameRef = useRef(0);
  const jumpLimitRef = useRef(0);
  /*
   * The hold lasts until the feed has been quiet for JUMP_QUIET_MS, up to JUMP_LIMIT_MS. It was
   * a fixed 500 ms at first, and WebKit in CI showed why that is wrong: on a slow device the
   * overwrites outlasted it and the list ended 40 to 160 px short. Each overwrite renews it.
   */
  const extendHold = useCallback(() => {
    jumpUntilRef.current = Math.min(performance.now() + JUMP_QUIET_MS, jumpLimitRef.current);
  }, []);
  const anchorRef = useRef<{ el: HTMLElement; offset: number } | null>(null);
  const onPinnedChangeRef = useRef(onPinnedChange);
  onPinnedChangeRef.current = onPinnedChange;

  // The window. Following: the newest `cap`. Reading back: the start stays where it was, so no
  // row leaves from under the reader, until the hard limit.
  const pinnedStart = Math.max(0, data.length - cap);
  if (pinnedRef.current) startRef.current = pinnedStart;
  else startRef.current = Math.max(Math.min(startRef.current, pinnedStart), data.length - cap * UNPINNED_CAP_FACTOR, 0);
  // Backfill: `shown` is how many rows up from the end may be drawn yet.
  const [shown, setShown] = useState(FIRST_PAINT_ROWS);
  const start = Math.max(startRef.current, data.length - shown);
  const backfilling = start > startRef.current;
  useEffect(() => {
    if (!backfilling) return;
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
      .requestIdleCallback;
    const cancelIdle = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
    const grow = () => setShown((n) => n + BACKFILL_ROWS);
    // Safari has no requestIdleCallback; a short timeout after paint does the same job.
    const id = idle ? idle(grow, { timeout: 200 }) : window.setTimeout(grow, 32);
    return () => (idle && cancelIdle ? cancelIdle(id) : window.clearTimeout(id));
  }, [backfilling, shown]);

  const setPinned = useCallback(
    (pinned: boolean) => {
      if (pinnedRef.current === pinned) return;
      pinnedRef.current = pinned;
      feedTimings.count(pinned ? `${pane}.scroll.follow` : `${pane}.scroll.unfollow`);
      if (pinned) anchorRef.current = null;
      onPinnedChangeRef.current?.(pinned);
    },
    [pane],
  );

  const toEnd = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    lastTopRef.current = el.scrollTop;
    lastSizeRef.current = { content: el.scrollHeight, viewport: el.clientHeight };
  }, []);

  /** Remember the first row on screen and where it sits, to put it back after a reflow. */
  const recordAnchor = useCallback(() => {
    const el = scrollerRef.current;
    const list = listRef.current;
    if (!el || !list) return;
    const top = el.getBoundingClientRect().top;
    for (const child of list.children) {
      const box = child.getBoundingClientRect();
      if (box.bottom > top + 1) {
        anchorRef.current = { el: child as HTMLElement, offset: box.top - top };
        return;
      }
    }
    anchorRef.current = null;
  }, []);

  const restoreAnchor = useCallback(() => {
    const el = scrollerRef.current;
    const anchor = anchorRef.current;
    if (!el || !anchor || !anchor.el.isConnected) return;
    const delta = anchor.el.getBoundingClientRect().top - el.getBoundingClientRect().top - anchor.offset;
    if (Math.abs(delta) < 1) return;
    el.scrollTop += delta;
    lastTopRef.current = el.scrollTop;
    feedTimings.count(`${pane}.scroll.anchor`);
  }, [pane]);

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || el.clientHeight === 0) return;
    const top = el.scrollTop;
    const gap = el.scrollHeight - top - el.clientHeight;
    const movedUp = top < lastTopRef.current - 1;
    const reflowed =
      el.scrollHeight !== lastSizeRef.current.content || el.clientHeight !== lastSizeRef.current.viewport;
    lastTopRef.current = top;
    lastSizeRef.current = { content: el.scrollHeight, viewport: el.clientHeight };
    if (performance.now() < jumpUntilRef.current) {
      // A jump to the end is being held and the reader has not touched the feed since
      // (a touch, wheel or key ends the hold). Whatever moved the feed, it was not them.
      if (gap > 0) {
        toEnd();
        extendHold();
      }
      return;
    }
    if (reflowed) {
      // Not the reader. Do what the resize observer would: it may not have run yet.
      if (pinnedRef.current) toEnd();
      else restoreAnchor();
      return;
    }
    if (gap <= PIN_THRESHOLD_PX) {
      setPinned(true);
      return;
    }
    if (pinnedRef.current) {
      if (movedUp) {
        setPinned(false);
        recordAnchor();
      } else {
        // Off the end without the reader moving up: the content grew, or the viewport
        // shrank, and this event raced the resize observer. Stay pinned.
        toEnd();
      }
      return;
    }
    recordAnchor();
  }, [extendHold, recordAnchor, restoreAnchor, setPinned, toEnd]);

  // New rows, before paint. Also the first paint: the list is at the end from frame one.
  useLayoutEffect(() => {
    if (pinnedRef.current) {
      toEnd();
      return;
    }
    // Reading back: rows added above (backfill) must not move the row being read; rows added
    // below move nothing. Either way the content is taller, and that is not a reflow.
    restoreAnchor();
    const el = scrollerRef.current;
    if (el) lastSizeRef.current = { content: el.scrollHeight, viewport: el.clientHeight };
  }, [data.length, start, toEnd, restoreAnchor]);

  // Anything else that changes a size: fonts, a theme, the pane's width, the roster above the
  // feed, a pane shown after `display: none`.
  useEffect(() => {
    const el = scrollerRef.current;
    const list = listRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (pinnedRef.current) toEnd();
      else {
        restoreAnchor();
        lastSizeRef.current = { content: el.scrollHeight, viewport: el.clientHeight };
      }
    });
    observer.observe(el);
    if (list) observer.observe(list);
    return () => observer.disconnect();
  }, [toEnd, restoreAnchor, data.length === 0]);

  /*
   * Go to the end and stay there for a moment.
   *
   * One `scrollTop = scrollHeight` is not enough on a phone. The owner's iPhone, on
   * the plain list, landed near the end but not at it. An iOS momentum scroll keeps running
   * after the assignment and writes its own next position over ours; the scroll event that
   * follows has a lower `scrollTop` and unchanged sizes, which is exactly what the reader
   * moving up looks like, so the list unpinned short of the end. No test browser reproduces
   * momentum (the WebKit phone project scrolls in script), so this is defended in three ways:
   * stop the momentum (a scroller that briefly cannot scroll drops it), re-assert the end on
   * each frame until the feed has been quiet, and during the hold do not read a scroll event as the reader.
   * A touch, wheel or key ends the hold at once: the reader always wins.
   */
  const releaseHold = useCallback(() => {
    jumpUntilRef.current = 0;
    if (jumpFrameRef.current) cancelAnimationFrame(jumpFrameRef.current);
    jumpFrameRef.current = 0;
  }, []);

  const holdEnd = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    releaseHold();
    jumpLimitRef.current = performance.now() + JUMP_LIMIT_MS;
    extendHold();
    const overflowY = el.style.overflowY;
    el.style.overflowY = 'hidden';
    toEnd();
    // A frame callback that runs inside `requestAnimationFrame` itself (unit tests stub it
    // that way) would recurse until the stack ran out. Such a call is not a frame: stop.
    let scheduling = false;
    const nextFrame = () => {
      scheduling = true;
      jumpFrameRef.current = requestAnimationFrame(step);
      scheduling = false;
    };
    const step = () => {
      if (scheduling) {
        el.style.overflowY = overflowY;
        return;
      }
      jumpFrameRef.current = 0;
      el.style.overflowY = overflowY;
      if (!pinnedRef.current || performance.now() >= jumpUntilRef.current) {
        jumpUntilRef.current = 0;
        return;
      }
      if (el.scrollHeight - el.scrollTop - el.clientHeight > 0) {
        toEnd();
        extendHold();
      }
      nextFrame();
    };
    nextFrame();
  }, [extendHold, releaseHold, toEnd]);

  useEffect(() => releaseHold, [releaseHold]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToBottom() {
        feedTimings.count(`${pane}.scroll.jump`);
        // Instant. A smooth scroll aims at a pixel that moves when a row arrives mid-flight,
        // which is how `↓ Latest` came to stop short (baseline S2).
        setPinned(true);
        holdEnd();
      },
      isPinned: () => pinnedRef.current,
    }),
    [pane, setPinned, holdEnd],
  );

  useLayoutEffect(() => {
    feedTimings.count(`${pane}.list.mount`);
  }, [pane]);

  const rows: ReactNode[] = [];
  for (let i = start; i < data.length; i += 1) {
    const item = data[i]!;
    rows.push(
      <Row
        key={rowKey(item, i)}
        item={item}
        index={i}
        flag={rowFlag ? rowFlag(item) : false}
        version={rowVersion}
        render={renderRow}
      />,
    );
  }

  return (
    <div
      ref={scrollerRef}
      className="event-feed event-feed-plain"
      role="log"
      aria-live="polite"
      aria-label={ariaLabel}
      tabIndex={0}
      onScroll={onScroll}
      onTouchStart={releaseHold}
      onWheel={releaseHold}
      onKeyDown={releaseHold}
      onPointerDown={releaseHold}
    >
      {rows.length > 0 ? (
        <ol ref={listRef} className="event-feed-list">
          {rows}
        </ol>
      ) : (
        empty
      )}
    </div>
  );
}

const PlainFeedList = forwardRef(PlainFeedListInner) as <T>(
  props: PlainFeedListProps<T> & { ref?: React.Ref<PlainFeedHandle> },
) => ReactNode;

export default PlainFeedList;
