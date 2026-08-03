import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  RingFeedContext,
  type RingFeedApi,
  type TrackedRingFeedEvent,
} from '../hooks/useRingFeed.js';
import RingPane from '../components/RingPane.js';

const scrollToIndexMock = vi.fn();
const setAtBottomState: Array<(atBottom: boolean) => void> = [];
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
        return (
          <div>
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

describe('RingPane scroll follow behavior', () => {
  it('does not auto-scroll when user has scrolled away from bottom', () => {
    listeners.clear();
    setAtBottomState.length = 0;
    render(
      <TestFeed>
        <RingPane roomId="room-123" isActive />
      </TestFeed>,
    );

    const atBottomHandler = setAtBottomState[0];
    expect(typeof atBottomHandler).toBe('function');
    if (!atBottomHandler) throw new Error('atBottomStateChange missing');

    // Simulate user scrolling up.
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
  });
});
