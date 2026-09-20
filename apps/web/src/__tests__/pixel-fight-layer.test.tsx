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

function combatEvent(combat: unknown): TrackedRingFeedEvent {
  return {
    id: crypto.randomUUID(),
    data: {
      id: crypto.randomUUID(),
      roomId: 'room-1',
      timestamp: 0,
      type: 'announce',
      scope: 'public',
      text: '',
      payload: { combat },
    },
  };
}

function fightConclusion(): TrackedRingFeedEvent {
  return {
    ...fightStart(),
    id: 'fight-conclusion',
    data: { ...fightStart().data, id: 'fight-conclusion', payload: { eventName: 'fightConcludes' } },
  };
}

describe('PixelFightLayer', () => {
  const fillRect = vi.fn();
  const clearRect = vi.fn();
  const rafCallbacks = new Map<number, FrameRequestCallback>();
  let nextRaf = 1;
  const raf = vi.fn((callback: FrameRequestCallback) => {
    const handle = nextRaf++;
    rafCallbacks.set(handle, callback);
    return handle;
  });
  const cancelRaf = vi.fn();
  let now = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    now = 0;
    listener = undefined;
    fillRect.mockClear();
    clearRect.mockClear();
    raf.mockClear();
    cancelRaf.mockClear();
    rafCallbacks.clear();
    nextRaf = 1;
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', cancelRaf);
    vi.spyOn(performance, 'now').mockImplementation(() => now);
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
      setTransform: vi.fn(),
      imageSmoothingEnabled: false,
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('draws a frame after fightBegins and cancels its animation frame on unmount', () => {
    const { container, unmount } = render(
      <PixelFightLayer contestants={contestants} viewerUserId="viewer" />,
    );

    act(() => listener?.(fightStart()));

    expect(container.querySelector('.pixel-fight-stage')).toHaveClass('active');
    expect(fillRect).toHaveBeenCalled();
    expect(raf).toHaveBeenCalled();

    unmount();
    expect(cancelRaf).toHaveBeenCalled();
  });

  it('draws one static frame and schedules no loop for reduced motion', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    render(<PixelFightLayer contestants={contestants} viewerUserId="viewer" />);

    clearRect.mockClear();
    act(() => listener?.(fightStart()));

    expect(clearRect).toHaveBeenCalledTimes(1);
    expect(raf).not.toHaveBeenCalled();
  });

  it('settles attack, hit, and flee deadlines with fake timers and no further feed events', () => {
    const { container } = render(<PixelFightLayer contestants={contestants} viewerUserId="viewer" />);
    act(() => listener?.(fightStart()));
    expect(vi.getTimerCount()).toBe(1);
    now = 400;
    act(() => vi.advanceTimersByTime(400));

    act(() => listener?.(combatEvent({ kind: 'card', actor: { name: 'Aqim' } })));
    expect(vi.getTimerCount()).toBe(1);
    now = 800;
    act(() => vi.advanceTimersByTime(400));
    expect(container.querySelector('.pixel-fight-stage')).toHaveClass('active');

    act(() => listener?.(combatEvent({
      kind: 'hit', actor: { name: 'Aqim' }, target: { name: 'Mara' }, damage: 8, hp: 14, maxHp: 22,
    })));
    expect(vi.getTimerCount()).toBe(1);
    now = 1_050;
    act(() => vi.advanceTimersByTime(250));

    act(() => listener?.(combatEvent({ kind: 'flee', actor: { name: 'Mara' } })));
    expect(vi.getTimerCount()).toBe(1);
    now = 1_450;
    act(() => vi.advanceTimersByTime(400));
    expect(container.querySelector('.pixel-fight-stage')).toHaveClass('active');
  });

  it('settles the fade timeout inactive and cancels RAF without another feed event', () => {
    const { container } = render(<PixelFightLayer contestants={contestants} viewerUserId="viewer" />);
    act(() => listener?.(fightStart()));
    now = 400;
    act(() => vi.advanceTimersByTime(400));
    cancelRaf.mockClear();

    act(() => listener?.(fightConclusion()));
    now = 2_900;
    act(() => vi.advanceTimersByTime(2_500));

    expect(container.querySelector('.pixel-fight-stage')).not.toHaveClass('active');
    expect(cancelRaf).toHaveBeenCalled();
  });

  it('re-arms when the fade timer fires a hair before its deadline instead of stalling', () => {
    // Browsers clamp timers to whole ms while performance.now() is sub-ms, so a timeout
    // can wake fractionally early. Settling then changes nothing, no re-render follows,
    // and without a re-arm the canvas stays active until an unrelated feed event.
    const { container } = render(<PixelFightLayer contestants={contestants} viewerUserId="viewer" />);
    act(() => listener?.(fightStart()));
    now = 400;
    act(() => vi.advanceTimersByTime(400));

    act(() => listener?.(fightConclusion()));
    now = 2_899.6;
    act(() => vi.advanceTimersByTime(2_500));
    expect(container.querySelector('.pixel-fight-stage')).toHaveClass('active');
    expect(vi.getTimerCount(), 'a follow-up timer must be armed').toBe(1);

    now = 2_901;
    act(() => vi.advanceTimersByTime(2));
    expect(container.querySelector('.pixel-fight-stage')).not.toHaveClass('active');
  });

  it('does not reset its backing store between equal-size draws and resizes when size changes', () => {
    let width = 640;
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockImplementation(() => (
      { width, height: 200 } as DOMRect
    ));
    const { container } = render(<PixelFightLayer contestants={contestants} viewerUserId="viewer" />);
    const canvas = container.querySelector('canvas')!;
    const assignedWidths: number[] = [];
    Object.defineProperty(canvas, 'width', {
      configurable: true,
      get: () => assignedWidths.at(-1) ?? 300,
      set: (next: number) => assignedWidths.push(next),
    });

    act(() => listener?.(fightStart()));
    const firstFrame = rafCallbacks.values().next().value as FrameRequestCallback;
    act(() => firstFrame(100));
    expect(assignedWidths).toEqual([640]);

    width = 480;
    act(() => firstFrame(200));
    expect(assignedWidths).toEqual([640, 480]);
  });
});
