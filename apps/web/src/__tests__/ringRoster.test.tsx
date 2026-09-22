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
    // `AC`, not `ac` — an initialism, and the lexicon's compact spelling.
    expect(screen.getByText('AC 15')).toBeTruthy();
    expect(screen.getByText('12/60')).toBeTruthy();
    expect(screen.getByText('AC 13')).toBeTruthy();
  });

  it('counts only living monsters as standing', () => {
    render(
      <RingRoster
        contestants={[contestant(), contestant({ name: 'Aqim', hp: 0, dead: true, userId: 'user-2' })]}
        collapsed={false}
        onToggle={noop}
      />
    );

    // Two counts rather than a fraction: `1/2` cannot say how a fight is going.
    expect(screen.getByText(/1 standing · 1 fallen/)).toBeTruthy();
  });

  it('marks a fallen monster instead of showing its hp numbers', () => {
    render(
      <RingRoster
        contestants={[contestant({ hp: 0, dead: true })]}
        collapsed={false}
        onToggle={noop}
      />
    );

    // "fallen" is the lexicon's word; "defeated" appears nowhere in it.
    expect(screen.getByText('fallen')).toBeTruthy();
    expect(screen.queryByText('0/50')).toBeNull();
  });

  it('badges a boss and credits the house that stages it', () => {
    render(
      <RingRoster
        contestants={[contestant({ isBoss: true, owner: null, userId: null })]}
        collapsed={false}
        onToggle={noop}
      />
    );

    expect(screen.getByText('BOSS')).toBeTruthy();
    // A boss has no beastmaster, so the field would otherwise sit empty.
    expect(screen.getByText('👑 The Editor')).toBeTruthy();
  });

  it('shows teams only once more than one of them is standing', () => {
    const oneTeam = render(
      <RingRoster
        contestants={[
          contestant({ team: 'The Alliance' }),
          contestant({ name: 'Aqim', userId: 'user-2', team: 'The Alliance' }),
        ]}
        collapsed={false}
        onToggle={noop}
      />
    );
    // One team down the whole list is not information.
    expect(oneTeam.container.querySelector('.roster-team-pip')).toBeNull();
    expect(oneTeam.queryByText?.('The Alliance') ?? null).toBeNull();
    oneTeam.unmount();

    render(
      <RingRoster
        contestants={[
          contestant({ team: 'Gryffindor' }),
          contestant({ name: 'Aqim', userId: 'user-2', team: 'Slytherin' }),
        ]}
        collapsed={false}
        onToggle={noop}
      />
    );

    // Once in the row's meta line, once in the legend that names every colour in play.
    expect(screen.getAllByText('Gryffindor')).toHaveLength(2);
    expect(screen.getAllByText('Slytherin')).toHaveLength(2);
    expect(screen.getByRole('list', { name: 'Teams in play' })).toBeTruthy();
  });

  it('drops a wiped-out team from the relevance test', () => {
    const { container } = render(
      <RingRoster
        contestants={[
          contestant({ team: 'Gryffindor' }),
          contestant({ name: 'Aqim', userId: 'user-2', team: 'Slytherin', hp: 0, dead: true }),
        ]}
        collapsed={false}
        onToggle={noop}
      />
    );

    // Only one side is still standing, so allegiance has stopped discriminating.
    expect(container.querySelector('.roster-team-pip')).toBeNull();
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

    expect(screen.getByText(/1 standing/)).toBeTruthy();
    expect(screen.queryByText('40/50')).toBeNull();
  });

  it('keeps one row shape at every density, so width can decide the layout', () => {
    // Dense rows were briefly a second markup branch, which could not compose with the
    // column breakpoints. Density is a class now; the DOM is identical either way.
    const shape = (count: number) => {
      const list = Array.from({ length: count }, (_, i) =>
        contestant({ name: `M${i}`, userId: `u${i}` }));
      const { container, unmount } = render(
        <RingRoster contestants={list} collapsed={false} onToggle={noop} />
      );
      const row = container.querySelector('.roster-row')!;
      const markup = row.innerHTML;
      const dense = container.querySelector('.roster-list')!.className.includes('dense');
      unmount();
      return { markup, dense };
    };

    const small = shape(3);
    const big = shape(12);

    expect(small.dense).toBe(false);
    expect(big.dense).toBe(true);
    // Same row, whatever the count — only the list's class differs.
    expect(big.markup).toBe(small.markup);
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

  it('marks the acting contestant and only that one', () => {
    const { container } = render(
      <RingRoster
        contestants={[
          contestant({ acting: true }),
          contestant({ name: 'Aqim', userId: 'user-2', acting: false }),
        ]}
        collapsed={false}
        onToggle={noop}
      />
    );

    const rows = container.querySelectorAll('.roster-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.classList.contains('roster-row-acting')).toBe(true);
    expect(rows[0]!.getAttribute('aria-label')).toContain('acting now');
    expect(rows[1]!.classList.contains('roster-row-acting')).toBe(false);
    expect(rows[1]!.getAttribute('aria-label')).not.toContain('acting now');
  });

  it('does not mark a dead contestant as acting', () => {
    const { container } = render(
      <RingRoster
        contestants={[contestant({ hp: 0, dead: true, acting: true })]}
        collapsed={false}
        onToggle={noop}
      />
    );

    const row = container.querySelector('.roster-row');
    expect(row!.classList.contains('roster-row-acting')).toBe(false);
    expect(row!.getAttribute('aria-label')).not.toContain('acting now');
  });

  it('keeps the BOSS tag outside the clipped name text', () => {
    const longName = 'Charri (charloat, To Listen)';
    const { container } = render(
      <RingRoster
        contestants={[contestant({ name: longName, isBoss: true, owner: null, userId: null })]}
        collapsed={false}
        onToggle={noop}
      />
    );

    const nameText = container.querySelector('.roster-name-text');
    const bossTag = container.querySelector('.roster-tag-boss');
    expect(nameText).not.toBeNull();
    expect(bossTag).not.toBeNull();
    expect(nameText!.textContent).toBe(longName);
    expect(nameText!.contains(bossTag)).toBe(false);
    expect(bossTag!.parentElement).toBe(nameText!.parentElement);
  });
});
