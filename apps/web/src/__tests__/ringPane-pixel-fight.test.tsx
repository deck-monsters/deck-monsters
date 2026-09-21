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

type StubProps = { children?: ReactNode };

/** Stands in for PixelSprites: passes the roster through, marks that it mounted. */
const SpritesStub: ComponentType<StubProps> = ({ children }) => (
  <>{children}<canvas className="pixel-sprites-stub" aria-hidden="true" /></>
);

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
    // These cases exercise the *theme* gate, so opt in to the animations first; the
    // separate opt-in gate is covered below.
    localStorage.setItem('deck-monsters-pixel-fight-stage', '1');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-features');
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
  });

  it('defers the lazy loader until the switcher enables pixel art', async () => {
    const LayerTarget = SpritesStub;
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
        <RingPane roomId="room-1" isActive pixelSpritesLoader={loader} />
      </TestFeed>,
    );

    expect(loader).not.toHaveBeenCalled();
    expect(container.querySelector('.pixel-sprites-stub')).toBeNull();

    await act(async () => screen.getByRole('button', { name: 'street fighter' }).click());
    await waitFor(() => expect(container.querySelector('.pixel-sprites-stub')).not.toBeNull());
    expect(loader).toHaveBeenCalledTimes(1);

    await act(async () => screen.getByRole('button', { name: 'phosphor' }).click());
    await waitFor(() => expect(container.querySelector('.pixel-sprites-stub')).toBeNull());
  });

  it('remounts the pixel layer with an empty scene when the room changes', async () => {
    const mounts = vi.fn();
    const LayerTarget: ComponentType<StubProps> = ({ children }) => {
      useEffect(() => {
        mounts();
      }, []);
      return <>{children}<canvas className="pixel-sprites-stub" aria-hidden="true" /></>;
    };
    const loader = vi.fn(async () => ({ default: LayerTarget }));
    function Switcher() {
      const { setTheme } = useTheme();
      return <button onClick={() => setTheme('street-fighter')}>street fighter</button>;
    }

    const { rerender } = render(
      <TestFeed>
        <Switcher />
        <RingPane roomId="room-1" isActive pixelSpritesLoader={loader} />
      </TestFeed>,
    );

    await act(async () => screen.getByRole('button', { name: 'street fighter' }).click());
    await waitFor(() => expect(mounts).toHaveBeenCalledTimes(1));

    rerender(
      <TestFeed>
        <Switcher />
        <RingPane roomId="room-2" isActive pixelSpritesLoader={loader} />
      </TestFeed>,
    );

    await waitFor(() => expect(mounts).toHaveBeenCalledTimes(2));
  });

  it('stays text-only on the pixel-art theme until the player opts in', async () => {
    // Default off: choosing the SNES palette is not the same as asking for animated
    // monsters, so the sprites are something a player opts into.
    localStorage.removeItem('deck-monsters-pixel-fight-stage');
    const loader = vi.fn(async () => ({ default: SpritesStub }));
    function Switcher() {
      const { setTheme } = useTheme();
      return <button onClick={() => setTheme('street-fighter')}>street fighter</button>;
    }

    const { container } = render(
      <TestFeed>
        <Switcher />
        <RingPane roomId="room-1" isActive pixelSpritesLoader={loader} />
      </TestFeed>,
    );

    await act(async () => screen.getByRole('button', { name: 'street fighter' }).click());

    expect(container.querySelector('.pixel-sprites-stub')).toBeNull();
    // Not merely hidden — the chunk is never fetched for a player who has not asked.
    expect(loader).not.toHaveBeenCalled();
  });

  it('mounts the stage once an opted-in player is on the pixel-art theme', async () => {
    const loader = vi.fn(async () => ({ default: SpritesStub }));
    function Switcher() {
      const { setTheme } = useTheme();
      return <button onClick={() => setTheme('street-fighter')}>street fighter</button>;
    }

    const { container } = render(
      <TestFeed>
        <Switcher />
        <RingPane roomId="room-1" isActive pixelSpritesLoader={loader} />
      </TestFeed>,
    );

    await act(async () => screen.getByRole('button', { name: 'street fighter' }).click());
    await waitFor(() => expect(container.querySelector('.pixel-sprites-stub')).not.toBeNull());
  });
});
