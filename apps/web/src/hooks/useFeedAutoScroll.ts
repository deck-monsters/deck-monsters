import { useCallback, useMemo, useRef, type RefObject } from 'react';
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
 * most output (#157). A wheel/touch/scrollbar/keyboard gesture is the only evidence that
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
 * fold for the rest of the burst (#157). Must stay under one feed line.
 */
export const AT_BOTTOM_THRESHOLD_PX = 8;

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
 * the scroller itself; the events bubble).
 */
export function useFeedAutoScroll(virtuosoRef?: RefObject<VirtuosoHandle | null>) {
  const shouldFollowRef = useRef(true);
  // Wall-clock time of the reader's last scroll gesture inside the feed. 0 means "none
  // recently" — reset by jump-to-latest and tab activation so those are not mistaken for
  // scrolling away a moment later.
  const userScrollGestureAtRef = useRef(0);

  const onAtBottomChange = useCallback(
    (atBottom: boolean): boolean => {
      if (atBottom) {
        shouldFollowRef.current = true;
        return true;
      }
      if (Date.now() - userScrollGestureAtRef.current <= USER_SCROLL_INTENT_WINDOW_MS) {
        shouldFollowRef.current = false;
        return false;
      }
      // The bottom moved away on its own. Not the reader's doing — re-pin instead of
      // switching off (#157). Instant, not smooth: a smooth scroll is what ended short in
      // the first place. Following stays on, so report "at bottom" and keep the jump
      // button hidden rather than flashing it for the frame before the snap lands.
      virtuosoRef?.current?.scrollToIndex({ index: 'LAST', behavior: 'auto' });
      return true;
    },
    [virtuosoRef]
  );

  const resetToBottom = useCallback(() => {
    shouldFollowRef.current = true;
    userScrollGestureAtRef.current = 0;
  }, []);

  const enable = resetToBottom;

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
      onAtBottomChange,
      resetToBottom,
      enable,
      gestureHandlers,
    }),
    [onAtBottomChange, resetToBottom, enable, gestureHandlers]
  );
}
