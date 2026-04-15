import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RingPane from '../components/RingPane.js';

const subscriptionCallbacks: {
  onData?: (tracked: { id: string; data: unknown }) => void;
  onError?: () => void;
} = {};

const scrollToIndexMock = vi.fn();
const setAtBottomState: Array<(atBottom: boolean) => void> = [];

vi.mock('../hooks/useHandshake.js', () => ({
  useHandshake: () => ({
    handleHandshakeEvent: vi.fn(),
  }),
}));

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
      ringFeed: {
        useSubscription: (_input: unknown, callbacks: { onData?: (tracked: { id: string; data: unknown }) => void; onError?: () => void }) => {
          subscriptionCallbacks.onData = callbacks.onData;
          subscriptionCallbacks.onError = callbacks.onError;
        },
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

describe('RingPane scroll follow behavior', () => {
  it('does not auto-scroll when user has scrolled away from bottom', () => {
    render(<RingPane roomId="room-123" isActive onEvent={() => undefined} />);

    expect(typeof subscriptionCallbacks.onData).toBe('function');
    if (!subscriptionCallbacks.onData) throw new Error('subscription callback missing');

    const atBottomHandler = setAtBottomState[0];
    expect(typeof atBottomHandler).toBe('function');
    if (!atBottomHandler) throw new Error('atBottomStateChange missing');

    // Simulate user scrolling up.
    atBottomHandler(false);

    scrollToIndexMock.mockClear();
    subscriptionCallbacks.onData({
      id: 'ev-1',
      data: {
        id: 'event-1',
        type: 'announce',
        scope: 'public',
        text: 'new public event',
        payload: {},
        timestamp: Date.now(),
      },
    });

    expect(scrollToIndexMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth' }),
    );
  });
});
