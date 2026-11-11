import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  RingFeedContext,
  type RingFeedApi,
  type TrackedRingFeedEvent,
} from '../hooks/useRingFeed.js';

/**
 * What the Console says while its history loads (baseline C7), and the history query's
 * options. On a slow link it used to say "Type a command below to start" for the seconds it
 * took the player's earlier session to arrive.
 */

const ROOM = '11111111-1111-1111-1111-111111111111';
const listeners = new Set<(tracked: TrackedRingFeedEvent) => void>();

const mocks = vi.hoisted(() => ({
  history: undefined as unknown[] | undefined,
  historyError: false,
  historyOptions: undefined as unknown,
}));

vi.mock('react-virtuoso', () => {
  const React = require('react');
  const Virtuoso = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ scrollToIndex: () => undefined }));
    const Empty = props.components?.EmptyPlaceholder;
    return (
      <div>
        {props.data?.length ? props.data.map((ev: any, i: number) => (
          <React.Fragment key={ev.id ?? i}>{props.itemContent(i, ev)}</React.Fragment>
        )) : Empty ? <Empty /> : null}
      </div>
    );
  });
  return { Virtuoso };
});

vi.mock('../lib/auth-context.js', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('../lib/command-insert-context.js', () => ({
  useCommandInsert: () => ({ registerInsertFn: () => undefined }),
}));
vi.mock('../hooks/useCommandAutocomplete.js', () => ({ useCommandAutocomplete: () => [] }));
vi.mock('../hooks/useGuidedStart.js', () => ({
  useGuidedStart: () => ({ phase: 'hidden', name: '', slots: 0, fightComing: false, fightOn: false, hasFled: false, dismiss: () => undefined }),
}));
vi.mock('../hooks/useChat.js', () => ({
  useChat: () => ({
    messages: [],
    unread: 0,
    lastReadId: 0,
    markRead: () => undefined,
    send: async () => null,
    members: [],
    dmCandidates: [],
    refreshNames: () => undefined,
    subscribeLive: () => () => undefined,
  }),
}));
vi.mock('../lib/trpc.js', () => ({
  trpc: {
    game: {
      consoleHistory: {
        useQuery: (_input: unknown, options: unknown) => {
          mocks.historyOptions = options;
          return { data: mocks.history, isError: mocks.historyError };
        },
      },
      pendingPrompt: { useQuery: () => ({ data: null, dataUpdatedAt: 0, refetch: vi.fn() }) },
      ringState: { useQuery: () => ({ data: { contestants: [] } }) },
      myMonsters: { useQuery: () => ({ data: [], refetch: vi.fn(async () => ({ data: [] })) }) },
      myInventory: {
        useQuery: () => ({
          data: { items: { character: [], monsters: [] } },
          refetch: vi.fn(async () => ({ data: { items: { character: [], monsters: [] } } })),
        }),
      },
      command: { useMutation: () => ({ mutateAsync: vi.fn(async () => ({ ok: true })) }) },
      respondToPrompt: { useMutation: () => ({ mutateAsync: vi.fn(async () => ({ ok: true })) }) },
      cancelPrompt: { useMutation: () => ({ mutateAsync: vi.fn(async () => ({ ok: true })) }) },
      cancelFlow: { useMutation: () => ({ mutateAsync: vi.fn(async () => ({ ok: true })) }) },
    },
  },
}));
vi.mock('../utils/format-event-text.js', () => ({ formatEventText: (text: string) => text }));
vi.mock('../utils/console-history-event-map.js', () => ({ mapConsoleHistoryEvent: () => null }));

import ConsolePane from '../components/ConsolePane.js';

function TestFeed({ children, reconnecting = false }: { children: ReactNode; reconnecting?: boolean }) {
  const value: RingFeedApi = {
    connected: !reconnecting,
    reconnecting,
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

const pane = (reconnecting = false) => (
  <TestFeed reconnecting={reconnecting}>
    <ConsolePane roomId={ROOM} isActive />
  </TestFeed>
);

beforeEach(() => {
  localStorage.clear();
  listeners.clear();
  mocks.history = undefined;
  mocks.historyError = false;
  mocks.historyOptions = undefined;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ConsolePane empty state (baseline C7)', () => {
  it('says it is loading, not "type a command", while history is in flight', () => {
    render(pane());
    expect(screen.getByText('Loading your console…')).toBeTruthy();
    expect(screen.queryByText(/Type a command below to start/)).toBeNull();
  });

  it('shows the hint once history has loaded and is empty', () => {
    mocks.history = [];
    render(pane());
    expect(screen.getByText(/Type a command below to start/)).toBeTruthy();
    expect(screen.queryByText('Loading your console…')).toBeNull();
  });

  it('shows the hint when history failed, so the pane is not stuck on "Loading"', () => {
    mocks.historyError = true;
    render(pane());
    expect(screen.getByText(/Type a command below to start/)).toBeTruthy();
  });

  it('fetches history once: no refetch on focus or reconnect, never stale', () => {
    render(pane());
    expect(mocks.historyOptions).toEqual({
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    });
  });
});

describe('ConsolePane reconnecting row', () => {
  it('waits a second before adding "-- reconnecting --" to the transcript, and not at all for a shorter blip', () => {
    vi.useFakeTimers();
    mocks.history = [];
    const view = render(pane());

    act(() => view.rerender(pane(true)));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByText('-- reconnecting --')).toBeNull();
    act(() => view.rerender(pane(false)));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.queryByText('-- reconnecting --')).toBeNull();

    act(() => view.rerender(pane(true)));
    act(() => {
      vi.advanceTimersByTime(1_100);
    });
    expect(screen.getByText('-- reconnecting --')).toBeTruthy();
  });
});
