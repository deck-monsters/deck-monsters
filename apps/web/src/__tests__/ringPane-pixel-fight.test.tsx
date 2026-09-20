import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import RingPane from '../components/RingPane.js';
import { RingFeedContext, type RingFeedApi } from '../hooks/useRingFeed.js';

let pixelArtEnabled = false;

vi.mock('../hooks/useTheme.js', () => ({
  useThemeFeature: () => pixelArtEnabled,
}));

vi.mock('../animations/pixel-fight/PixelFightLayer.js', () => ({
  default: () => <canvas className="pixel-fight-layer" aria-hidden="true" />,
}));

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
  it('does not load the decorative layer for phosphor', () => {
    pixelArtEnabled = false;
    const { container } = render(
      <TestFeed><RingPane roomId="room-1" isActive /></TestFeed>,
    );

    expect(container.querySelector('.pixel-fight-layer')).toBeNull();
  });

  it('loads the decorative layer for street-fighter', async () => {
    pixelArtEnabled = true;
    const { container } = render(
      <TestFeed><RingPane roomId="room-1" isActive /></TestFeed>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelector('.pixel-fight-layer')).not.toBeNull();
  });
});
