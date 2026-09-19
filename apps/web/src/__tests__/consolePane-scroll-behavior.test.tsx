import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  RingFeedContext,
  type RingFeedApi,
  type TrackedRingFeedEvent,
} from '../hooks/useRingFeed.js';

const scrollToIndexMock = vi.fn();
let restoreRaf: (() => void) | null = null;
const listeners = new Set<(tracked: TrackedRingFeedEvent) => void>();
const trpcMocks = vi.hoisted(() => ({
  pendingPromptQuery: {
    data: null as null | {
      requestId: string;
      question: string;
      choices: string[];
      timeoutSeconds?: number;
    },
    dataUpdatedAt: 0,
    refetch: vi.fn(async () => ({ data: null })),
  },
}));

function pushEvent(tracked: TrackedRingFeedEvent) {
  for (const listener of listeners) listener(tracked);
}

let latestFollowOutput: ((atBottom: boolean) => unknown) | undefined;

vi.mock('react-virtuoso', () => {
  const React = require('react');

  const Virtuoso = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      scrollToIndex: scrollToIndexMock,
    }));

    // The component hands Virtuoso its follow-output policy; capture it so the test can
    // ask what it decides, rather than watching for an imperative scroll that no longer
    // happens. See 10b-bugs-fixed.md #129.
    latestFollowOutput = props.followOutput;

    return (
      <div>
        <div data-testid="event-count">{props.data?.length ?? 0}</div>
        <button type="button" onClick={() => props.atBottomStateChange?.(false)}>
          Mark not at bottom
        </button>
        <button type="button" onClick={() => props.atBottomStateChange?.(true)}>
          Mark at bottom
        </button>
      </div>
    );
  });

  return { Virtuoso };
});

vi.mock('../lib/auth-context.js', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../lib/command-insert-context.js', () => ({
  useCommandInsert: () => ({
    registerInsertFn: () => undefined,
  }),
}));

vi.mock('../hooks/useCommandAutocomplete.js', () => ({
  useCommandAutocomplete: () => [],
}));

vi.mock('../components/CommandSuggestions.js', () => ({
  default: () => null,
}));

vi.mock('../components/InlineChoices.js', () => ({
  default: () => null,
}));

vi.mock('../lib/trpc.js', () => ({
  trpc: {
    game: {
      consoleHistory: {
        useQuery: () => ({ data: undefined }),
      },
      pendingPrompt: {
        useQuery: () => trpcMocks.pendingPromptQuery,
      },
      myMonsters: {
        useQuery: () => ({ data: [] }),
      },
      myInventory: {
        useQuery: () => ({ data: { items: { character: [], monsters: [] } } }),
      },
      command: {
        useMutation: () => ({ mutateAsync: vi.fn(async () => ({ ok: true })) }),
      },
      respondToPrompt: {
        useMutation: () => ({ mutateAsync: vi.fn(async () => ({ ok: true })) }),
      },
      cancelPrompt: {
        useMutation: () => ({ mutateAsync: vi.fn(async () => ({ ok: true })) }),
      },
      cancelFlow: {
        useMutation: () => ({ mutateAsync: vi.fn(async () => ({ ok: true })) }),
      },
    },
  },
}));

vi.mock('../utils/format-event-text.js', () => ({
  formatEventText: (text: string) => text,
}));

vi.mock('../utils/console-history-event-map.js', () => ({
  mapConsoleHistoryEvent: () => null,
}));

import ConsolePane from '../components/ConsolePane.js';

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

describe('ConsolePane scroll behavior', () => {
  beforeEach(() => {
    scrollToIndexMock.mockReset();
    listeners.clear();
    trpcMocks.pendingPromptQuery.data = null;
    trpcMocks.pendingPromptQuery.dataUpdatedAt = 0;
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    restoreRaf = () => rafSpy.mockRestore();
  });

  afterEach(() => {
    restoreRaf?.();
    restoreRaf = null;
  });

  /**
   * The contract is unchanged — follow new output only when already at the bottom — but it
   * is now Virtuoso's `followOutput` that enforces it rather than an imperative
   * `scrollToIndex` per append. The mechanism matters: an imperative smooth scroll keeps
   * animating while the reader drags against it, and during a fight each new event queued
   * another, which is why the console "refused to scroll up". Virtuoso stops following the
   * moment the reader leaves the bottom. See 10b-bugs-fixed.md #129.
   */
  it('follows new output while the reader is at the bottom', () => {
    render(
      <TestFeed>
        <ConsolePane roomId="11111111-1111-1111-1111-111111111111" isActive={false} />
      </TestFeed>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mark at bottom' }));

    expect(latestFollowOutput?.(true)).toBe('smooth');
  });

  it('stops following once the reader scrolls away from the bottom', () => {
    render(
      <TestFeed>
        <ConsolePane roomId="11111111-1111-1111-1111-111111111111" isActive={false} />
      </TestFeed>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mark not at bottom' }));

    expect(latestFollowOutput?.(false)).toBe(false);
  });

  it('does not chase the feed with an imperative scroll on every append', () => {
    // The regression guard: an append must not schedule its own scroll. If it does, the
    // reader is fighting an animation that does not yield.
    render(
      <TestFeed>
        <ConsolePane roomId="11111111-1111-1111-1111-111111111111" isActive={false} />
      </TestFeed>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mark at bottom' }));
    scrollToIndexMock.mockClear();

    act(() => {
      pushEvent({
        id: 'evt-1',
        data: {
          id: 'evt-1',
          type: 'announce',
          scope: 'private',
          targetUserId: 'user-1',
          text: 'hello',
          payload: {},
          timestamp: Date.now(),
          roomId: '11111111-1111-1111-1111-111111111111',
        },
      });
    });

    expect(scrollToIndexMock).not.toHaveBeenCalled();
  });

  /**
   * The P1 from review: `useFeedAutoScroll()` returned a fresh object each render, so the
   * `[isActive, autoScroll]` effect re-ran on *every* render — and appending a console event
   * renders. An active console the reader had scrolled up was therefore re-pinned to the
   * bottom by the next event, which is the #129 symptom arriving through a different path.
   * See 10b-bugs-fixed.md #132.
   */
  it('does not re-pin an active console to the bottom on every append', () => {
    render(
      <TestFeed>
        <ConsolePane roomId="11111111-1111-1111-1111-111111111111" isActive />
      </TestFeed>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mark not at bottom' }));
    scrollToIndexMock.mockClear();

    act(() => {
      pushEvent({
        id: 'evt-active',
        data: {
          id: 'evt-active',
          type: 'announce',
          scope: 'private',
          targetUserId: 'user-1',
          text: 'a new line arrives',
          payload: {},
          timestamp: Date.now(),
          roomId: '11111111-1111-1111-1111-111111111111',
        },
      });
    });

    expect(scrollToIndexMock).not.toHaveBeenCalled();
  });

  it('still jumps to the bottom when the pane becomes active', () => {
    // The effect's actual purpose, which must survive the dependency fix.
    const { rerender } = render(
      <TestFeed>
        <ConsolePane roomId="11111111-1111-1111-1111-111111111111" isActive={false} />
      </TestFeed>,
    );
    scrollToIndexMock.mockClear();

    rerender(
      <TestFeed>
        <ConsolePane roomId="11111111-1111-1111-1111-111111111111" isActive />
      </TestFeed>,
    );

    expect(scrollToIndexMock).toHaveBeenCalled();
  });

  it('unlocks a prompt after reconnect polling confirms it no longer exists', () => {
    const roomId = '11111111-1111-1111-1111-111111111111';
    const view = render(
      <TestFeed>
        <ConsolePane roomId={roomId} isActive />
      </TestFeed>,
    );

    act(() => {
      pushEvent({
        id: 'prompt-request',
        data: {
          id: 'prompt-request',
          type: 'prompt.request',
          scope: 'private',
          targetUserId: 'user-1',
          text: 'Which card?',
          payload: { requestId: 'request-1', question: 'Which card?', choices: ['Hit'] },
          timestamp: Date.now(),
          roomId,
        },
      });
    });
    expect(screen.getByText(/Command suggestions are paused/)).toBeInTheDocument();

    trpcMocks.pendingPromptQuery.dataUpdatedAt = 1;
    view.rerender(<TestFeed><ConsolePane roomId={roomId} isActive /></TestFeed>);
    expect(screen.getByText(/Command suggestions are paused/)).toBeInTheDocument();

    trpcMocks.pendingPromptQuery.dataUpdatedAt = 2;
    view.rerender(<TestFeed><ConsolePane roomId={roomId} isActive /></TestFeed>);
    expect(screen.queryByText(/Command suggestions are paused/)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type a command…')).toBeEnabled();
  });
});
