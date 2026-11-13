import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  RingFeedContext,
  type RingFeedApi,
  type TrackedRingFeedEvent,
} from '../hooks/useRingFeed.js';
import RingPane from '../components/RingPane.js';

// The pane's side of the feed's contract: it hands the list rows, shows `↓ Latest` when the list
// reports it is no longer following, and asks it to scroll through its handle. How the list
// decides that is PlainFeedList's own business, proved in a real browser (e2e/scroll.spec.ts).
const feed = vi.hoisted(() => ({
  scrollToBottom: vi.fn(),
  onPinnedChange: undefined as undefined | ((pinned: boolean) => void),
  mounted: false,
  rows: 0,
}));

vi.mock('../components/PlainFeedList.js', () => {
  const React = require('react');
  return {
    default: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({ scrollToBottom: feed.scrollToBottom, isPinned: () => true }));
      feed.onPinnedChange = props.onPinnedChange;
      feed.mounted = true;
      feed.rows = props.data?.length ?? 0;
      return <div data-testid="plain-feed" />;
    }),
  };
});

const listeners = new Set<(tracked: TrackedRingFeedEvent) => void>();
const historyQuery = vi.hoisted(() => ({
  data: [] as unknown[] | undefined,
  isError: false,
}));

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
        useQuery: () => ({ data: historyQuery.data, isError: historyQuery.isError }),
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

function TestFeed({ children }: { children: ReactNode }) {
  const value: RingFeedApi = {
    connected: true,
    reconnecting: false,
    seedCursor: () => undefined,
    subscribeChat: () => () => undefined,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return <RingFeedContext.Provider value={value}>{children}</RingFeedContext.Provider>;
}

function ringEvent(id: string) {
  return {
    id,
    data: { id, type: 'announce', scope: 'public', text: `line ${id}`, payload: {}, timestamp: Date.now(), roomId: 'room-123' },
  } as unknown as TrackedRingFeedEvent;
}

function setPinned(pinned: boolean) {
  act(() => feed.onPinnedChange?.(pinned));
}

function renderPane(history: unknown[] | null = []) {
  historyQuery.data = history ?? undefined;
  historyQuery.isError = false;
  listeners.clear();
  feed.scrollToBottom.mockClear();
  feed.onPinnedChange = undefined;
  feed.mounted = false;
  return render(
    <TestFeed>
      <RingPane roomId="room-123" isActive />
    </TestFeed>,
  );
}

describe('RingPane scroll behavior', () => {
  it('shows no jump button while the list follows the bottom', () => {
    renderPane();
    expect(screen.queryByRole('button', { name: 'Jump to latest events' })).toBeNull();
  });

  it('shows "Latest" once the reader leaves the bottom, and it takes them back', () => {
    renderPane();
    setPinned(false);
    const jump = screen.getByRole('button', { name: 'Jump to latest events' });
    feed.scrollToBottom.mockClear();
    fireEvent.click(jump);
    expect(feed.scrollToBottom).toHaveBeenCalledTimes(1);
    // The list reports the arrival itself; the pane does not claim it up front.
    expect(screen.getByRole('button', { name: 'Jump to latest events' })).toBeTruthy();
    setPinned(true);
    expect(screen.queryByRole('button', { name: 'Jump to latest events' })).toBeNull();
  });

  it('does not scroll the list when an event arrives (following is the list\'s rule)', () => {
    renderPane();
    setPinned(false);
    feed.scrollToBottom.mockClear();
    act(() => pushEvent(ringEvent('e1')));
    expect(feed.rows).toBe(1);
    expect(feed.scrollToBottom).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Jump to latest events' })).toBeTruthy();
  });

  it('goes to the bottom when the tab becomes active', () => {
    const { rerender } = renderPane();
    feed.scrollToBottom.mockClear();
    rerender(
      <TestFeed>
        <RingPane roomId="room-123" isActive={false} />
      </TestFeed>,
    );
    rerender(
      <TestFeed>
        <RingPane roomId="room-123" isActive />
      </TestFeed>,
    );
    expect(feed.scrollToBottom).toHaveBeenCalled();
  });

  // The list mounts with the history already in `events`, so its first paint is the newest
  // rows and not the placeholder followed by a jump.
  it('keeps the list unmounted until history arrives', () => {
    renderPane(null);
    expect(feed.mounted).toBe(false);
    expect(screen.getByText('Waiting for fight events…')).toBeTruthy();
  });

  it('mounts the list once history has loaded, even when it is empty', () => {
    renderPane([]);
    expect(feed.mounted).toBe(true);
  });
});
