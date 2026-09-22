import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect, type ComponentType, type ReactNode } from 'react';
import RingPane from '../components/RingPane.js';
import { RingFeedContext, type RingFeedApi } from '../hooks/useRingFeed.js';
import { usePixelMonsters } from '../hooks/usePixelMonsters.js';

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

describe('RingPane pixel monsters setting', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
  });

  /** Stands in for the account view's checkbox, which shares the same store. */
  function Toggle() {
    const { pixelMonstersEnabled, setPixelMonstersEnabled } = usePixelMonsters();
    return (
      <button onClick={() => setPixelMonstersEnabled(!pixelMonstersEnabled)}>
        {pixelMonstersEnabled ? 'turn off' : 'turn on'}
      </button>
    );
  }

  it('shows the sprites by default, on the default theme', async () => {
    // On by default and on every theme: the default theme is phosphor, which used to be
    // text-only whatever the setting said.
    const loader = vi.fn(async () => ({ default: SpritesStub }));

    const { container } = render(
      <TestFeed>
        <RingPane roomId="room-1" isActive pixelSpritesLoader={loader} />
      </TestFeed>,
    );

    await waitFor(() => expect(container.querySelector('.pixel-sprites-stub')).not.toBeNull());
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('never fetches the sprite chunk for a player who opted out', async () => {
    localStorage.setItem('deck-monsters-pixel-fight-stage', '0');
    const loader = vi.fn(async () => ({ default: SpritesStub }));

    const { container } = render(
      <TestFeed>
        <RingPane roomId="room-1" isActive pixelSpritesLoader={loader} />
      </TestFeed>,
    );

    // Give a lazy load the chance to happen before asserting that it did not.
    await act(async () => undefined);
    expect(container.querySelector('.pixel-sprites-stub')).toBeNull();
    // Not merely hidden — the art stays out of the bundle this player downloads.
    expect(loader).not.toHaveBeenCalled();
  });

  it('follows the setting live, without a reload', async () => {
    const loader = vi.fn(async () => ({ default: SpritesStub }));

    const { container } = render(
      <TestFeed>
        <Toggle />
        <RingPane roomId="room-1" isActive pixelSpritesLoader={loader} />
      </TestFeed>,
    );

    await waitFor(() => expect(container.querySelector('.pixel-sprites-stub')).not.toBeNull());

    await act(async () => screen.getByRole('button', { name: 'turn off' }).click());
    await waitFor(() => expect(container.querySelector('.pixel-sprites-stub')).toBeNull());

    await act(async () => screen.getByRole('button', { name: 'turn on' }).click());
    await waitFor(() => expect(container.querySelector('.pixel-sprites-stub')).not.toBeNull());
    // React.lazy caches the resolved module, so turning it back on is not a second fetch.
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('remounts the sprite layer with an empty scene when the room changes', async () => {
    // A pose must not survive a room change (cc949ab) — `key={roomId}` on the provider.
    const mounts = vi.fn();
    const LayerTarget: ComponentType<StubProps> = ({ children }) => {
      useEffect(() => {
        mounts();
      }, []);
      return <>{children}<canvas className="pixel-sprites-stub" aria-hidden="true" /></>;
    };
    const loader = vi.fn(async () => ({ default: LayerTarget }));

    const { rerender } = render(
      <TestFeed>
        <RingPane roomId="room-1" isActive pixelSpritesLoader={loader} />
      </TestFeed>,
    );

    await waitFor(() => expect(mounts).toHaveBeenCalledTimes(1));

    rerender(
      <TestFeed>
        <RingPane roomId="room-2" isActive pixelSpritesLoader={loader} />
      </TestFeed>,
    );

    await waitFor(() => expect(mounts).toHaveBeenCalledTimes(2));
  });
});
