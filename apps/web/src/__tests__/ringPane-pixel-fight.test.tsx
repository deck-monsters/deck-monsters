import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect, type ComponentType, type ReactNode } from 'react';
import RingPane from '../components/RingPane.js';
import { RingFeedContext, type RingFeedApi } from '../hooks/useRingFeed.js';
import { useTheme } from '../hooks/useTheme.js';

vi.mock('../hooks/useRingKeyTimestamps.js', () => ({
  useRingKeyTimestamps: () => ({ ringKeyTimestampsEnabled: false }),
}));

vi.mock('../lib/trpc.js', () => ({
  trpc: {
    game: {
      ringHistory: { useQuery: () => ({ data: [] }) },
      recentFights: { useQuery: () => ({ data: [] }) },
      ringState: { useQuery: () => ({ data: undefined, refetch: () => Promise.resolve() }) },
    },
  },
}));

vi.mock('../utils/ring-feed-events.js', () => ({
  shouldRenderRingEvent: () => true,
}));

vi.mock('react-virtuoso', async () => {
  const React = await import('react');
  return {
    Virtuoso: React.forwardRef((_props, _ref) => <div className="event-feed" />),
  };
});

function TestFeed({ children }: { children: ReactNode }) {
  const value: RingFeedApi = {
    connected: true,
    reconnecting: false,
    seedCursor: () => undefined,
    subscribe: () => () => undefined,
  };
  return <RingFeedContext.Provider value={value}>{children}</RingFeedContext.Provider>;
}

describe('RingPane pixel art feature gate', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-features');
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
  });

  it('defers the lazy loader until the switcher enables pixel art', async () => {
    const LayerTarget: ComponentType = () => {
      return <canvas className="pixel-fight-layer" aria-hidden="true" />;
    };
    const loader = vi.fn(async () => ({ default: LayerTarget }));
    function Switcher() {
      const { setTheme } = useTheme();
      return (
        <>
          <button onClick={() => setTheme('street-fighter')}>street fighter</button>
          <button onClick={() => setTheme('phosphor')}>phosphor</button>
        </>
      );
    }

    const { container } = render(
      <TestFeed>
        <Switcher />
        <RingPane roomId="room-1" isActive pixelFightLayerLoader={loader} />
      </TestFeed>,
    );

    expect(loader).not.toHaveBeenCalled();
    expect(container.querySelector('.pixel-fight-layer')).toBeNull();

    await act(async () => screen.getByRole('button', { name: 'street fighter' }).click());
    await waitFor(() => expect(container.querySelector('.pixel-fight-layer')).not.toBeNull());
    expect(loader).toHaveBeenCalledTimes(1);

    await act(async () => screen.getByRole('button', { name: 'phosphor' }).click());
    await waitFor(() => expect(container.querySelector('.pixel-fight-layer')).toBeNull());
  });

  it('remounts the pixel layer with an empty scene when the room changes', async () => {
    const mounts = vi.fn();
    const LayerTarget: ComponentType = () => {
      useEffect(() => {
        mounts();
      }, []);
      return <canvas className="pixel-fight-layer" aria-hidden="true" />;
    };
    const loader = vi.fn(async () => ({ default: LayerTarget }));
    function Switcher() {
      const { setTheme } = useTheme();
      return <button onClick={() => setTheme('street-fighter')}>street fighter</button>;
    }

    const { rerender } = render(
      <TestFeed>
        <Switcher />
        <RingPane roomId="room-1" isActive pixelFightLayerLoader={loader} />
      </TestFeed>,
    );

    await act(async () => screen.getByRole('button', { name: 'street fighter' }).click());
    await waitFor(() => expect(mounts).toHaveBeenCalledTimes(1));

    rerender(
      <TestFeed>
        <Switcher />
        <RingPane roomId="room-2" isActive pixelFightLayerLoader={loader} />
      </TestFeed>,
    );

    await waitFor(() => expect(mounts).toHaveBeenCalledTimes(2));
  });
});
