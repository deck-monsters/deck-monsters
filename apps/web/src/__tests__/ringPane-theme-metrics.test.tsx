import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RingFeedContext, type RingFeedApi, type TrackedRingFeedEvent } from '../hooks/useRingFeed.js';
import { useTheme } from '../hooks/useTheme.js';
import RingPane from '../components/RingPane.js';

const listeners = new Set<(tracked: TrackedRingFeedEvent) => void>();
const mounts: number[][] = [];

vi.mock('../hooks/useRingKeyTimestamps.js', () => ({
  useRingKeyTimestamps: () => ({ ringKeyTimestampsEnabled: false }),
}));
vi.mock('../hooks/useTimeAgo.js', () => ({ useTimeAgo: () => 'just now' }));
vi.mock('../utils/ring-feed-events.js', () => ({ shouldRenderRingEvent: () => true }));
vi.mock('../lib/trpc.js', () => ({
  trpc: {
    game: {
      ringHistory: { useQuery: () => ({ data: [] }) },
      recentFights: { useQuery: () => ({ data: [] }) },
      ringState: { useQuery: () => ({ data: undefined, refetch: () => Promise.resolve() }) },
    },
  },
}));
// jsdom has no layout, so stand in for the live CSS: a non-default line height when the
// document is on the amber theme. Everything else is the real module.
vi.mock('../utils/feed-row-height.js', async (importActual) => {
  const actual = await importActual<typeof import('../utils/feed-row-height.js')>();
  return {
    ...actual,
    readFeedMetrics: () =>
      document.documentElement.getAttribute('data-theme') === 'amber'
        ? { ...actual.DEFAULT_FEED_METRICS, linePx: 30 }
        : actual.DEFAULT_FEED_METRICS,
  };
});
vi.mock('react-virtuoso', () => {
  const React = require('react');
  return {
    Virtuoso: React.forwardRef(
      (props: { heightEstimates?: number[] }, ref: React.Ref<unknown>) => {
        React.useImperativeHandle(ref, () => ({ scrollToIndex: () => undefined }));
        // Virtuoso reads the estimates only on its first render, so record that render.
        React.useState(() => mounts.push(props.heightEstimates ?? []));
        return <div data-testid="list" />;
      },
    ),
  };
});

let setTheme: ReturnType<typeof useTheme>['setTheme'] = () => undefined;
function ThemeProbe() {
  setTheme = useTheme().setTheme;
  return null;
}

function Harness() {
  const value: RingFeedApi = {
    connected: true,
    reconnecting: false,
    seedCursor: () => undefined,
    subscribeChat: () => () => undefined,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return (
    <RingFeedContext.Provider value={value}>
      <ThemeProbe />
      <RingPane roomId="room-1" isActive />
    </RingFeedContext.Provider>
  );
}

describe('RingPane feed metrics follow the theme', () => {
  beforeEach(() => {
    listeners.clear();
    mounts.length = 0;
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('remounts the list with fresh estimates when the theme changes', () => {
    render(<Harness />);
    act(() => {
      for (const listener of listeners) {
        listener({
          id: 'e1',
          data: { id: 'e1', roomId: 'room-1', timestamp: 1, type: 'announce', scope: 'public', text: 'hello', payload: {} },
        } as TrackedRingFeedEvent);
      }
    });
    expect(mounts).toHaveLength(1);

    act(() => setTheme('amber'));
    // The first mount may predate the history (an empty feed), which Virtuoso handles by
    // ignoring later estimates; the second mount has the event and the new theme's line.
    expect(mounts).toHaveLength(2);
    expect(mounts[1]![0]).toBeCloseTo(12.8 + 30, 5);
  });
});
