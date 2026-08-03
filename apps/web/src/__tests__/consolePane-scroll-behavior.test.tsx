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

function pushEvent(tracked: TrackedRingFeedEvent) {
  for (const listener of listeners) listener(tracked);
}

vi.mock('react-virtuoso', () => {
  const React = require('react');

  const Virtuoso = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      scrollToIndex: scrollToIndexMock,
    }));

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
        useQuery: () => ({ data: null, refetch: vi.fn(async () => ({ data: null })) }),
      },
      myMonsters: {
        useQuery: () => ({ data: [] }),
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

  it('only follows new events when already at bottom', () => {
    render(
      <TestFeed>
        <ConsolePane roomId="11111111-1111-1111-1111-111111111111" isActive={false} />
      </TestFeed>,
    );
    scrollToIndexMock.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Mark not at bottom' }));
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

    expect(scrollToIndexMock).toHaveBeenCalledTimes(0);

    fireEvent.click(screen.getByRole('button', { name: 'Mark at bottom' }));
    act(() => {
      pushEvent({
        id: 'evt-2',
        data: {
          id: 'evt-2',
          type: 'announce',
          scope: 'private',
          targetUserId: 'user-1',
          text: 'hello again',
          payload: {},
          timestamp: Date.now(),
          roomId: '11111111-1111-1111-1111-111111111111',
        },
      });
    });

    expect(scrollToIndexMock).toHaveBeenCalled();
  });
});
