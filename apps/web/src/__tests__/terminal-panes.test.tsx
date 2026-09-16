import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const PANE_SLOTS_KEY = 'dm:paneSlots';

vi.mock('../hooks/useHandshake.js', () => ({
  useHandshake: () => ({
    handshakeStatus: { status: 'ok', buildVersion: 'dev', serverTime: 'now' },
    handleHandshakeEvent: vi.fn(),
  }),
}));

vi.mock('../components/CatchUpBanner.js', () => ({
  default: () => null,
}));

vi.mock('../components/PaneDivider.js', () => ({
  default: () => <div data-testid="pane-divider" />,
}));

vi.mock('../lib/trpc.js', () => ({
  trpc: {
    game: {
      ringFeed: {
        useSubscription: () => undefined,
      },
    },
  },
}));

// Stand-ins for the three surfaces. Each renders a button that bumps an internal counter
// so tests can prove state survives a slot swap (i.e. the surface was not remounted).
function makeSurfaceMock(label: string) {
  return {
    default: ({ roomId, isActive }: { roomId: string; isActive?: boolean }) => {
      const React = require('react');
      const [count, setCount] = React.useState(0);
      return (
        <div data-testid={`surface-${label}`} data-room={roomId} data-active={String(isActive)}>
          <span>{label} content</span>
          <button onClick={() => setCount((c: number) => c + 1)}>{label} bump ({count})</button>
        </div>
      );
    },
  };
}

vi.mock('../components/RingPane.js', () => makeSurfaceMock('ring'));
vi.mock('../components/ConsolePane.js', () => makeSurfaceMock('console'));
vi.mock('../components/WorkshopPanel.js', () => ({
  default: ({ roomId }: { roomId: string }) => {
    const React = require('react');
    const [count, setCount] = React.useState(0);
    return (
      <div data-testid="surface-workshop" data-room={roomId}>
        <span>workshop content</span>
        <button onClick={() => setCount((c: number) => c + 1)}>workshop bump ({count})</button>
      </div>
    );
  },
}));

import Terminal from '../components/Terminal.js';

function renderTerminal(roomId = 'room-1') {
  return render(
    <MemoryRouter>
      <Terminal roomId={roomId} />
    </MemoryRouter>
  );
}

function installResizeObserver(width: number) {
  let cb: ResizeObserverCallback | null = null;
  class MockResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      cb = callback;
    }
    observe() {
      cb?.([{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver);
    }
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
  return {
    fireWidth(nextWidth: number) {
      act(() => {
        cb?.([{ contentRect: { width: nextWidth } } as ResizeObserverEntry], {} as ResizeObserver);
      });
    },
  };
}

function pressShortcut(key: '1' | '2' | '3') {
  fireEvent.keyDown(document, { key, ctrlKey: true });
}

describe('Terminal pane slots (Phase 2 — docs/roadmap/20-workspace-layout.md)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('defaults to ring in slot 0 and console in slot 1, wide layout', () => {
    installResizeObserver(1200);
    renderTerminal();

    expect(screen.getByTestId('surface-ring')).toBeTruthy();
    expect(screen.getByTestId('surface-console')).toBeTruthy();
    expect(screen.queryByTestId('surface-workshop')).toBeNull();
  });

  it('offers only the surfaces the sibling slot does not show (no duplicates)', () => {
    installResizeObserver(1200);
    renderTerminal();

    const selectors = screen.getAllByRole('combobox') as HTMLSelectElement[];
    expect(selectors).toHaveLength(2);

    const [leftSelector, rightSelector] = selectors;
    const leftOptions = within(leftSelector).getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
    const rightOptions = within(rightSelector).getAllByRole('option').map((o) => (o as HTMLOptionElement).value);

    // Left slot shows ring; its own value must stay selectable, but it must not offer
    // console again — that is the sibling (right) slot's surface.
    expect(leftOptions.sort()).toEqual(['ring', 'workshop']);
    // Right slot shows console; it must not offer ring again — that is the sibling
    // (left) slot's surface.
    expect(rightOptions.sort()).toEqual(['console', 'workshop']);
  });

  it('switching a slot via its selector shows the new surface and hides the old one', () => {
    installResizeObserver(1200);
    renderTerminal();

    const [, rightSelector] = screen.getAllByRole('combobox') as HTMLSelectElement[];
    fireEvent.change(rightSelector, { target: { value: 'workshop' } });

    expect(screen.getByTestId('surface-ring')).toBeTruthy();
    expect(screen.getByTestId('surface-workshop')).toBeTruthy();
    // Console is no longer in a slot; kept mounted but hidden (`display: none` on its
    // wrapper), not unmounted — so it must still be in the DOM.
    const consoleEl = screen.getByTestId('surface-console');
    expect(consoleEl).toBeTruthy();
    expect(consoleEl.closest('.terminal-slot')).toHaveStyle({ display: 'none' });
  });

  it('Cmd/Ctrl+3 in side-by-side puts the workshop where the console was, leaving the ring alone', () => {
    installResizeObserver(1200);
    renderTerminal();

    pressShortcut('3');

    expect(screen.getByTestId('surface-ring').closest('.terminal-slot')).not.toHaveStyle({ display: 'none' });
    expect(screen.getByTestId('surface-workshop').closest('.terminal-slot')).not.toHaveStyle({ display: 'none' });
    const consoleEl = screen.getByTestId('surface-console');
    expect(consoleEl.closest('.terminal-slot')).toHaveStyle({ display: 'none' });
  });

  it('Cmd/Ctrl+3 in tabbed layout selects the workshop tab', () => {
    installResizeObserver(600);
    renderTerminal();

    pressShortcut('3');

    const workshopTab = screen.getByRole('tab', { name: 'Workshop' });
    expect(workshopTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('surface-workshop').closest('.terminal-slot')).toHaveClass('active');
  });

  it('tapping a tab already shown in the other slot flips slots without duplicating it', () => {
    installResizeObserver(600);
    renderTerminal();

    // Default tabbed view shows console (slot 1). Selecting workshop first occupies
    // slot 1 (replacing console), then tapping "The Ring" — held by slot 0 — must just
    // reveal slot 0, not overwrite slot 1 with 'ring' too.
    fireEvent.click(screen.getByRole('tab', { name: 'Workshop' }));
    fireEvent.click(screen.getByRole('tab', { name: 'The Ring' }));

    expect(window.localStorage.getItem(PANE_SLOTS_KEY)).toBe(JSON.stringify(['ring', 'workshop']));
  });

  it('persists both slots to localStorage and restores them on the next mount', () => {
    installResizeObserver(1200);
    const { unmount } = renderTerminal();

    const [, rightSelector] = screen.getAllByRole('combobox') as HTMLSelectElement[];
    fireEvent.change(rightSelector, { target: { value: 'workshop' } });

    expect(window.localStorage.getItem(PANE_SLOTS_KEY)).toBe(JSON.stringify(['ring', 'workshop']));
    unmount();

    installResizeObserver(1200);
    renderTerminal();

    expect(screen.getByTestId('surface-ring')).toBeTruthy();
    expect(screen.getByTestId('surface-workshop')).toBeTruthy();
    expect(screen.queryByTestId('surface-console')).toBeNull();
  });

  it('still renders with a blocked localStorage', () => {
    const original = window.localStorage.getItem;
    const spy = vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      installResizeObserver(1200);
      renderTerminal();
      expect(screen.getByTestId('surface-ring')).toBeTruthy();
      expect(screen.getByTestId('surface-console')).toBeTruthy();
    } finally {
      spy.mockRestore();
      void original;
    }
  });

  it('keeps the selection when crossing the 1024px breakpoint', () => {
    const ro = installResizeObserver(1200);
    renderTerminal();

    const [, rightSelector] = screen.getAllByRole('combobox') as HTMLSelectElement[];
    fireEvent.change(rightSelector, { target: { value: 'workshop' } });
    expect(screen.getByTestId('surface-workshop')).toBeTruthy();

    ro.fireWidth(600);

    // Now tabbed; slot 1 (workshop) is not the default active slot (1 is, and it still
    // holds workshop), so the workshop stays the visible tab.
    expect(screen.getByTestId('surface-workshop').closest('.terminal-slot')).toHaveClass('active');

    ro.fireWidth(1200);
    expect(screen.getByTestId('surface-ring')).toBeTruthy();
    expect(screen.getByTestId('surface-workshop')).toBeTruthy();
  });

  it('does not unmount a surface when it is swapped out of a slot (state survives)', () => {
    installResizeObserver(1200);
    renderTerminal();

    // `{ hidden: true }` because a swapped-out slot is hidden via `display: none`, which
    // Testing Library's accessibility-tree-based queries otherwise exclude by default —
    // exactly the "kept mounted, hidden by CSS" behaviour this test is checking for.
    const consoleBump = () => screen.getByRole('button', { name: /console bump/, hidden: true });
    fireEvent.click(consoleBump());
    fireEvent.click(consoleBump());
    expect(consoleBump().textContent).toContain('(2)');

    const [, rightSelector] = screen.getAllByRole('combobox') as HTMLSelectElement[];
    fireEvent.change(rightSelector, { target: { value: 'workshop' } });
    // Console is hidden now, but still mounted with its counter intact.
    expect(consoleBump().textContent).toContain('(2)');

    // Swap back — still the same instance, count unaffected by the round trip.
    const [, rightSelectorAgain] = screen.getAllByRole('combobox') as HTMLSelectElement[];
    fireEvent.change(rightSelectorAgain, { target: { value: 'console' } });
    expect(consoleBump().textContent).toContain('(2)');
  });

  it('is keyed by roomId so a room switch remounts the surfaces', () => {
    installResizeObserver(1200);
    const { rerender } = render(
      <MemoryRouter>
        <Terminal roomId="room-a" />
      </MemoryRouter>
    );
    expect(screen.getByTestId('surface-ring').getAttribute('data-room')).toBe('room-a');

    rerender(
      <MemoryRouter>
        <Terminal roomId="room-b" />
      </MemoryRouter>
    );
    expect(screen.getByTestId('surface-ring').getAttribute('data-room')).toBe('room-b');
  });
});
