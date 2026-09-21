import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RingRoster, { type RingContestantSnapshot } from '../components/RingRoster.js';
import { RosterSpriteContext } from '../components/roster-sprite-context.js';
import RosterSprite, { ROSTER_SPRITE_PX } from '../animations/pixel-fight/RosterSprite.js';
import { resetFrameTicker, subscribeToFrames } from '../animations/pixel-fight/frame-ticker.js';

function contestant(overrides: Partial<RingContestantSnapshot> = {}): RingContestantSnapshot {
  return {
    name: 'Aster', icon: '🐍', creatureType: 'Basilisk', level: 2, hp: 10, maxHp: 10,
    ac: 7, dead: false, isBoss: false, team: null, owner: 'someone', userId: 'u1',
    ...overrides,
  };
}

const noop = () => undefined;

describe('roster sprites', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })));
  });
  afterEach(() => {
    resetFrameTicker();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders the monster icon when no sprite provider is present', () => {
    const { container } = render(
      <RingRoster contestants={[contestant()]} collapsed={false} onToggle={noop} />,
    );

    expect(container.querySelector('.roster-icon')).not.toBeNull();
    expect(container.querySelector('.roster-sprite-cell')).toBeNull();
  });

  it('swaps the icon for the sprite rather than showing both', () => {
    // Two pictures of the same monster in one row is the duplication this whole change
    // exists to remove; it must not come back at the row level.
    const api = { render: () => <canvas className="roster-sprite" /> };
    const { container } = render(
      <RosterSpriteContext.Provider value={api}>
        <RingRoster contestants={[contestant()]} collapsed={false} onToggle={noop} />
      </RosterSpriteContext.Provider>,
    );

    expect(container.querySelector('.roster-sprite-cell')).not.toBeNull();
    expect(container.querySelector('.roster-icon')).toBeNull();
  });

  it('adds no second HP bar — the row keeps exactly one', () => {
    const api = { render: () => <canvas className="roster-sprite" /> };
    const { container } = render(
      <RosterSpriteContext.Provider value={api}>
        <RingRoster contestants={[contestant()]} collapsed={false} onToggle={noop} />
      </RosterSpriteContext.Provider>,
    );

    expect(container.querySelectorAll('.roster-bar-track')).toHaveLength(1);
  });

  it('keeps the row accessible label free of sprite noise', () => {
    const api = { render: () => <canvas className="roster-sprite" /> };
    const { container } = render(
      <RosterSpriteContext.Provider value={api}>
        <RingRoster contestants={[contestant()]} collapsed={false} onToggle={noop} />
      </RosterSpriteContext.Provider>,
    );

    const row = container.querySelector('.roster-row')!;
    expect(row.getAttribute('aria-label')).toBe('Aster, 10 of 10 hit points, armor class 7');
    expect(container.querySelector('.roster-sprite-cell')!.textContent).toBe('');
  });

  it('asks the grid for wider columns only when rows carry a sprite', () => {
    // The sprite gutter plus an unshrinkable team tag and HP/AC exceeded a 13rem
    // two-up column, collapsing the monster's name to "G..". Rows without a sprite
    // keep the original, narrower columns.
    const bare = render(
      <RingRoster contestants={[contestant()]} collapsed={false} onToggle={noop} />,
    );
    expect(bare.container.querySelector('.roster-list')!.className)
      .not.toContain('roster-list-sprites');
    bare.unmount();

    const api = { render: () => <canvas className="roster-sprite" /> };
    const withSprites = render(
      <RosterSpriteContext.Provider value={api}>
        <RingRoster contestants={[contestant()]} collapsed={false} onToggle={noop} />
      </RosterSpriteContext.Provider>,
    );
    expect(withSprites.container.querySelector('.roster-list')!.className)
      .toContain('roster-list-sprites');
  });

  it('keeps a long team name from starving the monster name', () => {
    // Both are on the same line; the tag is the one that may be cut.
    const api = { render: () => <canvas className="roster-sprite" /> };
    const { container } = render(
      <RosterSpriteContext.Provider value={api}>
        <RingRoster
          contestants={[contestant({ name: 'Qroap Holnex', team: 'THE ALLIANCE' })]}
          collapsed={false}
          onToggle={noop}
        />
      </RosterSpriteContext.Provider>,
    );

    expect(container.querySelector('.roster-name-text')!.textContent).toBe('Qroap Holnex');
    expect(container.querySelector('.roster-tag')!.textContent).toBe('THE ALLIANCE');
  });

  it('draws at an integer scale into a square canvas', () => {
    const fillRect = vi.fn();
    const ctx = {
      imageSmoothingEnabled: true, fillStyle: '', save: vi.fn(), restore: vi.fn(),
      setTransform: vi.fn(), clearRect: vi.fn(), translate: vi.fn(), scale: vi.fn(), fillRect,
      canvas: { width: 0, height: 0 },
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(ctx as unknown as CanvasRenderingContext2D);

    const { container } = render(
      <RosterSprite creatureType="Basilisk" anim="idle" flash={false} startedAt={0} reducedMotion={false} />,
    );

    const canvas = container.querySelector('canvas')!;
    expect(canvas.style.width).toBe(`${ROSTER_SPRITE_PX}px`);
    expect(ROSTER_SPRITE_PX % 24).toBe(0);
    expect(fillRect).toHaveBeenCalled();
  });

  it('schedules no animation loop under reduced motion', () => {
    const raf = vi.fn();
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      imageSmoothingEnabled: true, fillStyle: '', save: vi.fn(), restore: vi.fn(),
      setTransform: vi.fn(), clearRect: vi.fn(), translate: vi.fn(), scale: vi.fn(),
      fillRect: vi.fn(), canvas: { width: 0, height: 0 },
    } as unknown as CanvasRenderingContext2D);

    render(
      <RosterSprite creatureType="Basilisk" anim="idle" flash={false} startedAt={0} reducedMotion />,
    );

    expect(raf).not.toHaveBeenCalled();
  });
});

describe('frame ticker', () => {
  afterEach(() => { resetFrameTicker(); vi.restoreAllMocks(); });

  it('runs one loop for many subscribers and stops when the last one leaves', () => {
    // Twelve contestants must not mean twelve animation loops.
    const raf = vi.fn(() => 1);
    const cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', cancel);

    const first = subscribeToFrames(() => undefined);
    const second = subscribeToFrames(() => undefined);
    expect(raf).toHaveBeenCalledTimes(1);

    act(() => first());
    expect(cancel).not.toHaveBeenCalled();

    act(() => second());
    expect(cancel).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
