import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrackedRingFeedEvent } from '../hooks/useRingFeed.js';
import PixelFightLayer from '../animations/pixel-fight/PixelFightLayer.js';

let listener: ((event: TrackedRingFeedEvent) => void) | undefined;

vi.mock('../hooks/useRingFeed.js', async () => {
  const React = await import('react');
  return {
    useRingFeedListener: (nextListener: (event: TrackedRingFeedEvent) => void) => {
      React.useEffect(() => {
        listener = nextListener;
        return () => {
          listener = undefined;
        };
      }, [nextListener]);
      return { connected: true, reconnecting: false, seedCursor: () => undefined };
    },
  };
});

const contestants = [
  {
    name: 'Aqim',
    icon: '🐍',
    creatureType: 'Basilisk',
    level: 4,
    hp: 30,
    maxHp: 30,
    ac: 12,
    dead: false,
    isBoss: false,
    team: null,
    owner: 'Viewer',
    userId: 'viewer',
  },
  {
    name: 'Mara',
    icon: '⚔️',
    creatureType: 'Gladiator',
    level: 3,
    hp: 22,
    maxHp: 22,
    ac: 11,
    dead: false,
    isBoss: false,
    team: null,
    owner: 'Opponent',
    userId: 'opponent',
  },
];

function fightStart(): TrackedRingFeedEvent {
  return {
    id: 'fight-start',
    data: {
      id: 'fight-start',
      roomId: 'room-1',
      timestamp: 0,
      type: 'ring.fight',
      scope: 'public',
      text: '',
      payload: { eventName: 'fightBegins' },
    },
  };
}

describe('PixelFightLayer', () => {
  const fillRect = vi.fn();
  const clearRect = vi.fn();
  const raf = vi.fn(() => 7);
  const cancelRaf = vi.fn();

  beforeEach(() => {
    listener = undefined;
    fillRect.mockClear();
    clearRect.mockClear();
    raf.mockClear();
    cancelRaf.mockClear();
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', cancelRaf);
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      canvas: { width: 640, height: 200 },
      clearRect,
      fillRect,
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      imageSmoothingEnabled: false,
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('draws a frame after fightBegins and cancels its animation frame on unmount', () => {
    const { container, unmount } = render(
      <PixelFightLayer contestants={contestants} viewerUserId="viewer" />,
    );

    act(() => listener?.(fightStart()));

    expect(container.querySelector('canvas.pixel-fight-layer')).toHaveClass('active');
    expect(fillRect).toHaveBeenCalled();
    expect(raf).toHaveBeenCalled();

    unmount();
    expect(cancelRaf).toHaveBeenCalledWith(7);
  });

  it('draws one static frame and schedules no loop for reduced motion', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    render(<PixelFightLayer contestants={contestants} viewerUserId="viewer" />);

    act(() => listener?.(fightStart()));

    expect(fillRect).toHaveBeenCalled();
    expect(raf).not.toHaveBeenCalled();
  });
});
