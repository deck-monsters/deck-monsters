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
type PendingPromptSnapshot = {
  requestId: string;
  question: string;
  choices: string[];
  timeoutSeconds?: number;
};

const trpcMocks = vi.hoisted(() => ({
  pendingPromptQuery: {
    data: null as null | PendingPromptSnapshot,
    dataUpdatedAt: 0,
    refetch: vi.fn(async (): Promise<{ data: PendingPromptSnapshot | null }> => ({ data: null })),
  },
  respondToPromptMutateAsync: vi.fn(async () => ({ ok: true })),
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
        useQuery: () => ({ data: [], refetch: vi.fn(async () => ({ data: [] })) }),
      },
      myInventory: {
        useQuery: () => ({
          data: { items: { character: [], monsters: [] } },
          refetch: vi.fn(async () => ({ data: { items: { character: [], monsters: [] } } })),
        }),
      },
      command: {
        useMutation: () => ({ mutateAsync: vi.fn(async () => ({ ok: true })) }),
      },
      respondToPrompt: {
        useMutation: () => ({ mutateAsync: trpcMocks.respondToPromptMutateAsync }),
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
    trpcMocks.respondToPromptMutateAsync.mockReset();
    trpcMocks.respondToPromptMutateAsync.mockImplementation(async () => ({ ok: true }));
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

    // A real scroll-up: a wheel gesture inside the feed, then Virtuoso reports the bottom lost.
    fireEvent.wheel(screen.getByRole('button', { name: 'Mark not at bottom' }), { deltaY: -120 });
    fireEvent.click(screen.getByRole('button', { name: 'Mark not at bottom' }));

    expect(latestFollowOutput?.(false)).toBe(false);
    expect(screen.getByRole('button', { name: 'Jump to latest messages' })).toBeTruthy();
  });

  /*
   * Regression (#157, console side): switching to the Console tab takes its viewport from
   * hidden to visible, and Virtuoso reports that as "not at bottom" with no scroll by the
   * reader. Treating it as a scroll-up left the console parked one screen above the reply
   * to the command you had just typed, with `↓ Latest` showing. Live capture during the
   * #157 verification.
   */
  it('re-pins instead of stopping when the bottom moves without a reader gesture', () => {
    render(
      <TestFeed>
        <ConsolePane roomId="11111111-1111-1111-1111-111111111111" isActive={false} />
      </TestFeed>,
    );
    scrollToIndexMock.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Mark not at bottom' }));

    expect(scrollToIndexMock).toHaveBeenCalledWith({ index: 'LAST', behavior: 'auto' });
    expect(latestFollowOutput?.(false)).toBe('smooth');
    expect(screen.queryByRole('button', { name: 'Jump to latest messages' })).toBeNull();
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

    fireEvent.wheel(screen.getByRole('button', { name: 'Mark not at bottom' }), { deltaY: -120 });
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

  /**
   * A stale response from the 3s `pendingPrompt` poll can land after the player has
   * already answered this exact requestId — the poll request was in flight before the
   * answer reached the server. `upsertPendingPrompt` used to overwrite the resolved
   * prompt back to pending unconditionally, which re-armed `activePromptId` and
   * reopened the "waiting for your answer" banner for a prompt the player was, at that
   * moment, literally in the middle of having just answered. See 10b-bugs-fixed.md
   * (September 2026 follow-up).
   */
  it('does not reopen the waiting banner when a stale poll echoes an already-answered prompt', () => {
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
          text: 'Which would you like to see?',
          payload: { requestId: 'request-shop-1', question: 'Which would you like to see?', choices: ['Items', 'Cards', 'Back Room'] },
          timestamp: Date.now(),
          roomId,
        },
      });
    });
    expect(screen.getByText(/Command suggestions are paused/)).toBeInTheDocument();

    // Answer it by typing, the same path the free-text/Discord-style answer takes.
    const input = screen.getByPlaceholderText('Type your answer or click a choice above…');
    fireEvent.change(input, { target: { value: 'Items' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.queryByText(/Command suggestions are paused/)).not.toBeInTheDocument();

    // A poll that was already in flight when the answer landed now resolves, echoing
    // the same requestId as still pending.
    trpcMocks.pendingPromptQuery.data = {
      requestId: 'request-shop-1',
      question: 'Which would you like to see?',
      choices: ['Items', 'Cards', 'Back Room'],
    };
    trpcMocks.pendingPromptQuery.dataUpdatedAt = 1;
    view.rerender(<TestFeed><ConsolePane roomId={roomId} isActive /></TestFeed>);

    expect(screen.queryByText(/Command suggestions are paused/)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type a command…')).toBeEnabled();
  });

  /**
   * The requestId-resolved guard above must not swallow legitimate recovery: if
   * `respondToPrompt` actually fails server-side (the answer did not land), `handleAnswer`
   * explicitly refetches and re-arms the still-pending prompt. Marking a requestId
   * "resolved" optimistically, at click time, must not survive a failed submission — the
   * prompt genuinely never got answered and the player needs to see it again.
   */
  it('still re-arms the prompt when the answer submission itself fails', async () => {
    const roomId = '11111111-1111-1111-1111-111111111111';
    trpcMocks.respondToPromptMutateAsync.mockImplementation(async () => {
      throw new Error('network error');
    });
    const pendingSnapshot = {
      requestId: 'request-shop-1',
      question: 'Which would you like to see?',
      choices: ['Items', 'Cards', 'Back Room'],
    };
    trpcMocks.pendingPromptQuery.refetch = vi.fn(async () => ({ data: pendingSnapshot }));

    render(
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
          text: pendingSnapshot.question,
          payload: pendingSnapshot,
          timestamp: Date.now(),
          roomId,
        },
      });
    });

    const input = screen.getByPlaceholderText('Type your answer or click a choice above…');
    fireEvent.change(input, { target: { value: 'Items' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
      // Let the rejected mutateAsync and the recovery refetch settle.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText(/Command suggestions are paused/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type your answer or click a choice above…')).toBeEnabled();
  });
});
