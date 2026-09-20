import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  RingFeedContext,
  type RingFeedApi,
  type TrackedRingFeedEvent,
} from '../hooks/useRingFeed.js';
import RingPane from '../components/RingPane.js';
import { REPIN_SETTLE_MS } from '../hooks/useFeedAutoScroll.js';

const scrollToIndexMock = vi.fn();
const setAtBottomState: Array<(atBottom: boolean) => void> = [];
let followOutput: ((atBottom: boolean) => 'auto' | 'smooth' | false) | undefined;
let atBottomThreshold: number | undefined;
const listeners = new Set<(tracked: TrackedRingFeedEvent) => void>();

function pushEvent(tracked: TrackedRingFeedEvent) {
  for (const listener of listeners) listener(tracked);
}

vi.mock('../hooks/useRingKeyTimestamps.js', () => ({
  useRingKeyTimestamps: () => ({ ringKeyTimestampsEnabled: false }),
}));

vi.mock('../hooks/useTimeAgo.js', () => ({
  useTimeAgo: () => 'just now',
}));

vi.mock('../lib/trpc.js', () => ({
  trpc: {
    game: {
      ringHistory: {
        useQuery: () => ({ data: [] }),
      },
      recentFights: {
        useQuery: () => ({ data: [] }),
      },
      ringState: {
        useQuery: () => ({ data: undefined, refetch: () => Promise.resolve() }),
      },
    },
  },
}));

vi.mock('../utils/ring-feed-events.js', () => ({
  shouldRenderRingEvent: () => true,
}));

vi.mock('react-virtuoso', () => {
  const React = require('react');
  return {
    Virtuoso: React.forwardRef(
      (
        props: {
          atBottomStateChange?: (atBottom: boolean) => void;
          atBottomThreshold?: number;
          className?: string;
          followOutput?: (atBottom: boolean) => 'auto' | 'smooth' | false;
          data?: Array<unknown>;
          itemContent?: (index: number, item: unknown) => React.ReactNode;
        },
        ref: React.Ref<{ scrollToIndex: (input: { index: 'LAST'; behavior: 'auto' | 'smooth' }) => void }>,
      ) => {
        React.useImperativeHandle(ref, () => ({
          scrollToIndex: (input: { index: 'LAST'; behavior: 'auto' | 'smooth' }) => {
            scrollToIndexMock(input);
          },
        }));
        React.useEffect(() => {
          if (props.atBottomStateChange) setAtBottomState.push(props.atBottomStateChange);
        }, [props.atBottomStateChange]);
        followOutput = props.followOutput;
        atBottomThreshold = props.atBottomThreshold;
        return (
          <div className={props.className} data-testid="scroller">
            {(props.data ?? []).map((item, index) => (
              <div key={index}>{props.itemContent?.(index, item) ?? null}</div>
            ))}
          </div>
        );
      },
    ),
  };
});

function TestFeed({ children }: { children: ReactNode }) {
  const value: RingFeedApi = {
    connected: true,
    reconnecting: false,
    seedCursor: () => undefined,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return <RingFeedContext.Provider value={value}>{children}</RingFeedContext.Provider>;
}

function renderPane() {
  listeners.clear();
  setAtBottomState.length = 0;
  followOutput = undefined;
  atBottomThreshold = undefined;
  const utils = render(
    <TestFeed>
      <RingPane roomId="room-123" isActive />
    </TestFeed>,
  );
  const atBottomHandler = setAtBottomState[0];
  if (!atBottomHandler) throw new Error('atBottomStateChange missing');
  if (!followOutput) throw new Error('followOutput missing');
  scrollToIndexMock.mockClear();
  return { ...utils, atBottomHandler, scroller: utils.getByTestId('scroller') };
}

describe('RingPane scroll follow behavior', () => {
  it('does not auto-scroll when user has scrolled away from bottom', () => {
    const { atBottomHandler, scroller } = renderPane();

    // Simulate user scrolling up: a wheel gesture, then Virtuoso reports the bottom lost.
    fireEvent.wheel(scroller, { deltaY: -120 });
    act(() => {
      atBottomHandler(false);
    });

    scrollToIndexMock.mockClear();
    act(() => {
      pushEvent({
        id: 'ev-1',
        data: {
          id: 'event-1',
          type: 'announce',
          scope: 'public',
          text: 'new public event',
          payload: {},
          timestamp: Date.now(),
          roomId: 'room-123',
        },
      });
    });

    expect(scrollToIndexMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth' }),
    );
    expect(followOutput?.(false)).toBe(false);
  });

  /*
   * Regression (#159): the bottom can move away from the reader without the reader doing
   * anything — the roster grows, a card box is measured after it renders, a smooth follow
   * scroll ends short because the next line landed mid-animation. Treating every
   * "not at bottom" as a scroll-up switched following off in exactly those moments, and the
   * feed then sat a line or two above the newest narration for the rest of the burst.
   */
  it('re-pins to the bottom when the bottom moves away with no user gesture', () => {
    const { atBottomHandler, queryByRole } = renderPane();

    act(() => {
      atBottomHandler(false);
    });

    expect(scrollToIndexMock).toHaveBeenCalledWith({ index: 'LAST', behavior: 'auto' });
    expect(followOutput?.(false)).not.toBe(false);
    // Still following, so the jump button must not flash for the frame before the snap.
    expect(queryByRole('button', { name: 'Jump to latest events' })).toBeNull();
  });

  /*
   * The first snap can run before a freshly appended row is measured and land short; the
   * feed then sits there with nothing else to trigger a correction (seen live: 52px short
   * after a monster card). A second snap after layout settles closes it — unless the
   * reader has started scrolling up in the meantime.
   */
  it('snaps a second time once layout settles, unless the reader has since scrolled', () => {
    vi.useFakeTimers();
    try {
      const { atBottomHandler, scroller } = renderPane();
      // Flush the history-load rAF scroll so only the re-pin snaps are counted below.
      act(() => {
        vi.runOnlyPendingTimers();
      });
      scrollToIndexMock.mockClear();

      act(() => {
        atBottomHandler(false);
      });
      expect(scrollToIndexMock).toHaveBeenCalledTimes(1);
      act(() => {
        vi.advanceTimersByTime(REPIN_SETTLE_MS + 10);
      });
      expect(scrollToIndexMock).toHaveBeenCalledTimes(2);
      expect(scrollToIndexMock).toHaveBeenLastCalledWith({ index: 'LAST', behavior: 'auto' });

      // Now the reader scrolls up between the first snap and the settle snap.
      scrollToIndexMock.mockClear();
      act(() => {
        atBottomHandler(true);
        atBottomHandler(false);
      });
      expect(scrollToIndexMock).toHaveBeenCalledTimes(1);
      fireEvent.wheel(scroller, { deltaY: -120 });
      act(() => {
        vi.advanceTimersByTime(REPIN_SETTLE_MS + 10);
      });
      expect(scrollToIndexMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('treats a touch drag as the reader leaving the bottom', () => {
    const { atBottomHandler, scroller } = renderPane();

    fireEvent.touchMove(scroller);
    act(() => {
      atBottomHandler(false);
    });

    expect(scrollToIndexMock).not.toHaveBeenCalled();
    expect(followOutput?.(false)).toBe(false);
  });

  it('ignores a gesture that happened long before the bottom moved', () => {
    vi.useFakeTimers();
    try {
      const { atBottomHandler, scroller } = renderPane();

      fireEvent.wheel(scroller, { deltaY: -120 });
      vi.advanceTimersByTime(5_000);
      act(() => {
        atBottomHandler(false);
      });

      expect(scrollToIndexMock).toHaveBeenCalledWith({ index: 'LAST', behavior: 'auto' });
      expect(followOutput?.(false)).not.toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('resumes following once the reader returns to the bottom', () => {
    const { atBottomHandler, scroller } = renderPane();

    fireEvent.wheel(scroller, { deltaY: -120 });
    act(() => {
      atBottomHandler(false);
    });
    expect(followOutput?.(false)).toBe(false);

    act(() => {
      atBottomHandler(true);
    });
    expect(followOutput?.(false)).not.toBe(false);
  });

  it('jump-to-latest does not count as a scroll-away gesture', () => {
    const { atBottomHandler, getByRole, scroller } = renderPane();

    fireEvent.wheel(scroller, { deltaY: -120 });
    act(() => {
      atBottomHandler(false);
    });
    fireEvent.pointerDown(getByRole('button', { name: 'Jump to latest events' }));
    fireEvent.click(getByRole('button', { name: 'Jump to latest events' }));
    scrollToIndexMock.mockClear();

    // The bottom moves again right after the jump (e.g. the roster re-rendered).
    act(() => {
      atBottomHandler(false);
    });

    expect(scrollToIndexMock).toHaveBeenCalledWith({ index: 'LAST', behavior: 'auto' });
    expect(followOutput?.(false)).not.toBe(false);
  });

  /*
   * Virtuoso only snaps a list that has grown ("SIZE_INCREASED") back to the bottom when it
   * considers the list *not* at the bottom, and "at the bottom" means within this many
   * pixels. #148 raised it to 72px to absorb fractional layout pixels, which also meant a
   * follow scroll that ended up to 72px short — several lines — was never corrected and the
   * `↓ Latest` button never appeared. Keep it well under one feed line (#159).
   */
  it('keeps the at-bottom tolerance under one feed line so Virtuoso still self-corrects', () => {
    renderPane();
    expect(atBottomThreshold).toBeDefined();
    expect(atBottomThreshold!).toBeLessThanOrEqual(12);
  });
});
