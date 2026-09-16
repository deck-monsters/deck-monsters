import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RingRoster, {
  hpRatio,
  hpBand,
  type RingContestantSnapshot,
} from '../components/RingRoster.js';

function contestant(over: Partial<RingContestantSnapshot> = {}): RingContestantSnapshot {
  return {
    name: 'Stonefang',
    icon: '🐍',
    creatureType: 'Basilisk',
    level: 4,
    hp: 40,
    maxHp: 50,
    ac: 15,
    dead: false,
    isBoss: false,
    team: null,
    owner: 'Ada',
    userId: 'user-1',
    ...over,
  };
}

describe('hpRatio', () => {
  it('returns the plain ratio in range', () => {
    expect(hpRatio(25, 50)).toBe(0.5);
  });

  it('clamps overkill damage to 0 rather than rendering an inverted bar', () => {
    expect(hpRatio(-12, 50)).toBe(0);
  });

  it('clamps overheal to 1 rather than overflowing the track', () => {
    expect(hpRatio(80, 50)).toBe(1);
  });

  it('treats a missing or zero maxHp as empty instead of dividing by zero', () => {
    expect(hpRatio(10, 0)).toBe(0);
    expect(hpRatio(10, Number.NaN)).toBe(0);
  });
});

describe('hpBand', () => {
  it('bands by remaining health', () => {
    expect(hpBand(1)).toBe('healthy');
    expect(hpBand(0.5)).toBe('healthy');
    expect(hpBand(0.49)).toBe('hurt');
    expect(hpBand(0.2)).toBe('hurt');
    expect(hpBand(0.19)).toBe('critical');
    expect(hpBand(0)).toBe('critical');
  });
});

describe('RingRoster', () => {
  const noop = () => {};

  it('renders nothing when the ring is empty', () => {
    const { container } = render(
      <RingRoster contestants={[]} collapsed={false} onToggle={noop} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows live hp and ac for each contestant', () => {
    render(
      <RingRoster
        contestants={[contestant(), contestant({ name: 'Aqim', hp: 12, maxHp: 60, ac: 13, userId: 'user-2' })]}
        collapsed={false}
        onToggle={noop}
      />
    );

    expect(screen.getByText('40/50')).toBeTruthy();
    expect(screen.getByText('ac 15')).toBeTruthy();
    expect(screen.getByText('12/60')).toBeTruthy();
    expect(screen.getByText('ac 13')).toBeTruthy();
  });

  it('counts only living monsters as standing', () => {
    render(
      <RingRoster
        contestants={[contestant(), contestant({ name: 'Aqim', hp: 0, dead: true, userId: 'user-2' })]}
        collapsed={false}
        onToggle={noop}
      />
    );

    expect(screen.getByText(/1\/2 standing/)).toBeTruthy();
  });

  it('marks a defeated monster instead of showing its hp numbers', () => {
    render(
      <RingRoster
        contestants={[contestant({ hp: 0, dead: true })]}
        collapsed={false}
        onToggle={noop}
      />
    );

    expect(screen.getByText('defeated')).toBeTruthy();
    expect(screen.queryByText('0/50')).toBeNull();
  });

  it('labels bosses and team assignments', () => {
    render(
      <RingRoster
        contestants={[contestant({ isBoss: true, owner: null, userId: null, team: 'Alliance' })]}
        collapsed={false}
        onToggle={noop}
      />
    );

    expect(screen.getByText('BOSS')).toBeTruthy();
    expect(screen.getByText('Alliance')).toBeTruthy();
  });

  it('flags the viewer’s own monsters', () => {
    const { container } = render(
      <RingRoster
        contestants={[contestant({ userId: 'user-1' }), contestant({ name: 'Aqim', userId: 'user-2' })]}
        myUserId="user-1"
        collapsed={false}
        onToggle={noop}
      />
    );

    expect(container.querySelectorAll('.roster-row-mine')).toHaveLength(1);
  });

  it('hides the list when collapsed but keeps the summary toggle', () => {
    render(
      <RingRoster contestants={[contestant()]} collapsed onToggle={noop} />
    );

    expect(screen.getByText(/1\/1 standing/)).toBeTruthy();
    expect(screen.queryByText('40/50')).toBeNull();
  });

  it('calls onToggle when the summary is clicked', () => {
    const onToggle = vi.fn();
    render(<RingRoster contestants={[contestant()]} collapsed={false} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('exposes each health bar as an accessible meter', () => {
    render(<RingRoster contestants={[contestant()]} collapsed={false} onToggle={noop} />);

    const meter = screen.getByRole('meter', { name: 'Stonefang health' });
    expect(meter.getAttribute('aria-valuenow')).toBe('40');
    expect(meter.getAttribute('aria-valuemax')).toBe('50');
  });
});
