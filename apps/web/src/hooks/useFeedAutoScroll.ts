import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import type { VirtuosoHandle } from 'react-virtuoso';

/**
 * How recently the reader must have scrolled for a "not at bottom" report from Virtuoso
 * to count as *them* leaving the bottom, rather than the bottom leaving them.
 *
 * The bottom moves on its own all the time: the roster grows a row, a card box is measured
 * after it renders, a smooth follow scroll ends short because the next line landed
 * mid-animation, a pane goes from hidden to visible on a tab switch. Virtuoso reports all
 * of those as "not at bottom", and for months both feeds answered every one by switching
 * following off — so they stopped following at exactly the moments a fight produces the
 * most output (#159). A wheel/touch/scrollbar/keyboard gesture is the only evidence that
 * the reader wanted to scroll up; without one inside this window we re-pin instead. The
 * window is generous because Virtuoso throttles the report and a touch fling keeps
 * scrolling after the finger lifts.
 */
export const USER_SCROLL_INTENT_WINDOW_MS = 1_500;

/**
 * Pixels from the true bottom that still count as "at the bottom".
 *
 * Absorbs fractional layout pixels on mobile without disabling Virtuoso's own
 * self-correction: when the list grows and it considers itself *not* at the bottom, it
 * snaps back down. #148 set the Ring's to 72px so a shrinking viewport would not un-pin
 * the feed, but that also meant a follow scroll ending up to 72px short — several lines —
 * was never corrected and `↓ Latest` never appeared; the newest narration sat below the
 * fold for the rest of the burst (#159). Must stay under one feed line.
 */
export const AT_BOTTOM_THRESHOLD_PX = 8;

/**
 * Delay before the re-pin is repeated once. The first snap runs inside Virtuoso's
 * "not at bottom" callback, which can fire before a freshly appended row has been
 * measured (a monster card's `<pre>` block, say). The snap then targets the row's
 * estimated height and lands a few dozen pixels short — and because Virtuoso's at-bottom
 * state never returned to true, it reports nothing further, so the feed would sit there
 * silently until the next append. Seen live on the Console (#159): 52px short after a
 * `look at monsters` reply. One more snap after layout has settled closes it.
 */
export const REPIN_SETTLE_MS = 250;

/**
 * Follow-the-bottom policy shared by the Ring and Console feeds.
 *
 * `onAtBottomChange` is the heart of it: Virtuoso's "not at bottom" is treated as the
 * reader leaving only if a scroll gesture landed inside `USER_SCROLL_INTENT_WINDOW_MS`;
 * otherwise the feed is re-pinned with an instant scroll and keeps following. It returns
 * what the pane should display as "at bottom", so the jump button only appears when
 * following actually stopped — not for the frame between the report and the snap.
 *
 * Spread `gestureHandlers` onto the element wrapping the Virtuoso scroller (Virtuoso owns
 * the scroller itself; the events bubble) and pass `setScroller` as Virtuoso's `scrollerRef`.
 */
export function useFeedAutoScroll(virtuosoRef?: RefObject<VirtuosoHandle | null>) {
  const shouldFollowRef = useRef(true);
  // Virtuoso's scroller element, via its `scrollerRef` prop. The re-pin scrolls this to its
  // own `scrollHeight` rather than calling `scrollToIndex('LAST')`: that computes the target
  // from Virtuoso's size tree, which can still hold a freshly appended row's estimated
  // height when the callback fires — seen live as a 760px monster card booked 52px short,
  // so both snaps landed 52px above the bottom and the feed sat there (#159). The DOM's
  // scrollHeight is the ground truth.
  const scrollerRef = useRef<HTMLElement | null>(null);
  const setScroller = useCallback((el: HTMLElement | Window | null) => {
    scrollerRef.current = el instanceof HTMLElement ? el : null;
  }, []);
  // Wall-clock time of the reader's last scroll gesture inside the feed. 0 means "none
  // recently" — reset by jump-to-latest and tab activation so those are not mistaken for
  // scrolling away a moment later.
  const userScrollGestureAtRef = useRef(0);

  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (settleTimerRef.current !== null) clearTimeout(settleTimerRef.current);
    },
    []
  );

  const gestureIsRecent = () =>
    Date.now() - userScrollGestureAtRef.current <= USER_SCROLL_INTENT_WINDOW_MS;

  /** Follow new output again and forget any recent gesture. */
  const resetToBottom = useCallback(() => {
    shouldFollowRef.current = true;
    userScrollGestureAtRef.current = 0;
  }, []);
  const enable = resetToBottom;

  const scrollToEnd = useCallback(
    (behavior: 'auto' | 'smooth') => {
      const el = scrollerRef.current;
      if (el) {
        el.scrollTo({ top: el.scrollHeight, behavior });
        return;
      }
      virtuosoRef?.current?.scrollToIndex({ index: 'LAST', behavior });
    },
    [virtuosoRef]
  );

  /** Instant scroll to the true bottom — tab activation, history load. */
  const snapToBottom = useCallback(() => {
    scrollToEnd('auto');
    resetToBottom();
  }, [scrollToEnd, resetToBottom]);

  /**
   * The `↓ Latest` button. Smooth, and it does NOT claim "at bottom" for the caller:
   * Virtuoso reports that itself when the scroll arrives. Claiming it early (as both panes
   * used to) hid the button while a short-landing scroll left the feed 188px up — and since
   * Virtuoso's own state was still "not at bottom", the reader's next scroll-up produced no
   * transition either, so the button never came back.
   */
  const jumpToBottom = useCallback(() => {
    scrollToEnd('smooth');
    resetToBottom();
  }, [scrollToEnd, resetToBottom]);

  const onAtBottomChange = useCallback(
    (atBottom: boolean): boolean => {
      if (atBottom) {
        shouldFollowRef.current = true;
        return true;
      }
      if (gestureIsRecent()) {
        shouldFollowRef.current = false;
        return false;
      }
      // The bottom moved away on its own. Not the reader's doing — re-pin instead of
      // switching off (#159). Instant, not smooth: a smooth scroll is what ended short in
      // the first place. Following stays on, so report "at bottom" and keep the jump
      // button hidden rather than flashing it for the frame before the snap lands.
      const snap = () => scrollToEnd('auto');
      snap();
      if (settleTimerRef.current !== null) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(() => {
        settleTimerRef.current = null;
        // The reader may have started scrolling up in the meantime; leave them alone.
        if (shouldFollowRef.current && !gestureIsRecent()) snap();
      }, REPIN_SETTLE_MS);
      return true;
    },
    [scrollToEnd]
  );

  const noteUserScrollGesture = useCallback(() => {
    userScrollGestureAtRef.current = Date.now();
  }, []);

  const gestureHandlers = useMemo(
    () => ({
      // Scrolling *down* toward the bottom is never "leaving" it.
      onWheel: (e: React.WheelEvent) => {
        if (e.deltaY < 0) noteUserScrollGesture();
      },
      // A tap is not a scroll; touchmove is.
      onTouchMove: noteUserScrollGesture,
      // Mouse pointerdown covers scrollbar drags (the scrollbar has no element of its own,
      // so the event targets the scroller).
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse') noteUserScrollGesture();
      },
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Home') noteUserScrollGesture();
      },
    }),
    [noteUserScrollGesture]
  );

  /*
   * Memoised, because consumers put this object in effect dependency arrays. Returning a
   * fresh object literal each render made `[isActive, autoScroll]` in ConsolePane re-run on
   * *every* render — and since appending a console event renders, an active console that the
   * reader had scrolled up was re-pinned to the bottom by the next event. That is the same
   * symptom #129 fixed in the append path, arriving through the "became active" path
   * instead, which is why removing the one imperative scroll was not enough.
   * See 10b-bugs-fixed.md #132.
   */
  return useMemo(
    () => ({
      shouldFollowRef,
      setScroller,
      onAtBottomChange,
      resetToBottom,
      enable,
      snapToBottom,
      jumpToBottom,
      gestureHandlers,
    }),
    [setScroller, onAtBottomChange, resetToBottom, enable, snapToBottom, jumpToBottom, gestureHandlers]
  );
}
