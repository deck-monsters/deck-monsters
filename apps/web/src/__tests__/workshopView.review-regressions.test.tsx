import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const workshopMock = vi.hoisted(() => ({
  roomName: 'Test Room',
  monsters: [
    {
      name: 'Stonefang',
      type: 'Basilisk',
      level: 3,
      xpIntoLevel: 10,
      xpNeededForLevel: 50,
      inRing: false,
      inEncounter: false,
      cardSlots: 2,
      cards: [],
      presets: {},
    },
    {
      name: 'Emberclaw',
      type: 'Jinn',
      level: 2,
      xpIntoLevel: 5,
      xpNeededForLevel: 100,
      inRing: false,
      inEncounter: false,
      cardSlots: 2,
      cards: [],
      presets: {},
    },
  ],
  unequippedDeck: ['Hit'],
  cardCompatibility: {
    Hit: ['Stonefang'],
  },
  items: {
    character: [] as never[],
    monsters: [] as never[],
  },
  loading: false,
  busy: false,
	consoleFlowActive: false,
	pendingPrompt: null as null | { question: string },
	cancelConsoleFlow: vi.fn(async () => ({ ok: true })),
  latestError: null as string | null,
  equipCards: vi.fn(async () => ({ equippedCount: 1, requestedCount: 1, skippedCards: [] as string[] })),
  unequipCard: vi.fn(async () => ({ removedCount: 1, monsterName: 'Stonefang' })),
  unequipMany: vi.fn(async () => ({ removedCount: 1, monsterName: 'Stonefang' })),
  unequipAll: vi.fn(async () => ({ removedCount: 0, monsterName: 'Stonefang' })),
  moveCard: vi.fn(async () => ({ movedCount: 1, fromMonsterName: 'Stonefang', toMonsterName: 'Emberclaw' })),
  moveMany: vi.fn(async () => ({ movedCount: 1, fromMonsterName: 'Stonefang', toMonsterName: 'Emberclaw' })),
  reorderCards: vi.fn(async () => ({ monsterName: 'Stonefang', cards: ['Hit'] })),
  savePreset: vi.fn(async () => undefined),
  loadPreset: vi.fn(async () => ({ equippedCount: 0, requestedCount: 0, skippedCards: [] as string[] })),
  deletePreset: vi.fn(async () => undefined),
  refresh: vi.fn(async () => undefined),
}));

// WorkshopView resolves the room's name for AppShell directly from `room.info`, the way
// FightLogView and LeaderboardView do, rather than through useDeckWorkshop — see the
// comment in the view for why. That makes the tRPC client a dependency of this render.
vi.mock('../lib/trpc.js', () => ({
  trpc: {
    room: {
      info: {
        useQuery: () => ({ data: { name: workshopMock.roomName } }),
      },
    },
    // `WorkshopView` now wraps its content in `RingFeedProvider` (so the wallet/inventory
    // can go live off `ring.xp` events — see WorkshopPanel.tsx), which calls this
    // subscription on mount. A no-op is enough here: nothing in this file exercises live
    // feed delivery.
    game: {
      ringFeed: {
        useSubscription: () => undefined,
      },
    },
  },
}));

vi.mock('../hooks/useDeckWorkshop.js', () => ({
  useDeckWorkshop: () => workshopMock,
}));

vi.mock('../components/AppShell.js', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../components/InventoryPanel.js', () => ({
  default: ({
    onSelectCard,
    activeMonsterFilterName,
    onClearMonsterFilter,
    isCardUnavailable,
  }: {
    onSelectCard: (location: { kind: 'inventory' }, cardName: string, selectionId: string) => void;
    activeMonsterFilterName?: string | null;
    onClearMonsterFilter?: () => void;
    isCardUnavailable?: (cardName: string) => boolean;
  }) => (
    <div>
      <div data-testid="inventory-filter-name">{activeMonsterFilterName ?? 'none'}</div>
      <div data-testid="inventory-hit-unavailable">{String(isCardUnavailable?.('Hit') ?? false)}</div>
      <button
        type="button"
        onClick={() => onSelectCard({ kind: 'inventory' }, 'Hit', 'inventory:0')}
      >
        Select inventory card
      </button>
      <button type="button" onClick={() => onClearMonsterFilter?.()}>
        Clear inventory filter
      </button>
    </div>
  ),
}));

vi.mock('../components/MonsterWorkshopPanel.js', () => ({
  default: ({
    monster,
    showSelectionHint,
    onDropCard,
    compatibilityHint,
    onToggleFilter,
    isFilterTarget,
    onReorderCard,
  }: {
    monster: { name: string };
    showSelectionHint: boolean;
    onDropCard: (
      source: { kind: 'inventory' | 'monster'; monsterName?: string },
      cardName: string,
      sourceSelectionId?: string,
      targetSelectionId?: string,
    ) => Promise<void> | void;
    compatibilityHint?: 'none' | 'eligible' | 'ineligible';
    onToggleFilter?: () => void;
    isFilterTarget?: boolean;
    onReorderCard?: (sourceSelectionId: string, targetSelectionId: string) => Promise<void> | void;
  }) => (
    <section>
      <div data-testid={`hint-${monster.name}`}>{showSelectionHint ? 'hint-on' : 'hint-off'}</div>
      <div data-testid={`compat-${monster.name}`}>{compatibilityHint ?? 'none'}</div>
      <div data-testid={`filter-target-${monster.name}`}>{isFilterTarget ? 'yes' : 'no'}</div>
      <button type="button" onClick={() => onToggleFilter?.()}>
        Toggle filter {monster.name}
      </button>
      <button
        type="button"
        onClick={() => void onDropCard({ kind: 'inventory' }, 'Hit')}
      >
        Drop on {monster.name}
      </button>
      <button
        type="button"
        onClick={() => void onDropCard({ kind: 'monster', monsterName: monster.name }, 'Hit', `${monster.name}:0`, `${monster.name}:1`)}
      >
        Reorder on {monster.name}
      </button>
      <button
        type="button"
        onClick={() => void onReorderCard?.(`${monster.name}:0`, `${monster.name}:1`)}
      >
        Reorder via callback {monster.name}
      </button>
    </section>
  ),
}));

import WorkshopView from '../views/WorkshopView.js';

function renderWorkshop() {
  return render(
    <MemoryRouter initialEntries={['/room/11111111-1111-1111-1111-111111111111/workshop']}>
      <Routes>
        <Route path="/room/:roomId/workshop" element={<WorkshopView />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('WorkshopView review regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
	workshopMock.consoleFlowActive = false;
	workshopMock.pendingPrompt = null;
  });

	it('makes a blocking Console prompt visible and cancellable from the Workshop', async () => {
	  workshopMock.consoleFlowActive = true;
	  workshopMock.pendingPrompt = { question: 'Which cards?' };
	  renderWorkshop();

	  expect(screen.getByRole('alert')).toHaveTextContent('Workshop controls are paused');
	  expect(screen.getByRole('alert')).toHaveTextContent('Answer the waiting question');
	  fireEvent.click(screen.getByRole('button', { name: 'Cancel Console action' }));
	  await waitFor(() => expect(workshopMock.cancelConsoleFlow).toHaveBeenCalledOnce());
	});

  it('shows monster panel hints for inventory selections', () => {
    renderWorkshop();
    fireEvent.click(screen.getByRole('button', { name: 'Select inventory card' }));

    expect(screen.getByTestId('hint-Stonefang')).toHaveTextContent('hint-on');
    expect(screen.getByTestId('hint-Emberclaw')).toHaveTextContent('hint-on');
    expect(screen.getByTestId('compat-Stonefang')).toHaveTextContent('eligible');
    expect(screen.getByTestId('compat-Emberclaw')).toHaveTextContent('ineligible');
  });

  it('clears selected banner after drag/drop actions', async () => {
    renderWorkshop();
    fireEvent.click(screen.getByRole('button', { name: 'Select inventory card' }));

    expect(screen.getByText(/1 selected:/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Drop on Stonefang' }));

    await waitFor(() => {
      expect(screen.queryByText(/1 selected:/i)).not.toBeInTheDocument();
    });
  });

  it('keeps selection banner when clicking same-source destination area', async () => {
    renderWorkshop();
    fireEvent.click(screen.getByRole('button', { name: 'Select inventory card' }));

    expect(screen.getByText(/1 selected:/i)).toBeInTheDocument();

    // Clicking an inventory-source target now keeps selection state;
    // only card taps should toggle/off or swap source.
    fireEvent.click(screen.getByRole('button', { name: 'Drop on Stonefang' }));
    await waitFor(() => {
      expect(screen.queryByText(/1 selected:/i)).not.toBeInTheDocument();
    });
  });

  it('toggles monster filter and forwards filter state to inventory', () => {
    renderWorkshop();
    expect(screen.getByTestId('inventory-filter-name')).toHaveTextContent('none');
    expect(screen.getByTestId('inventory-hit-unavailable')).toHaveTextContent('false');

    fireEvent.click(screen.getByRole('button', { name: 'Toggle filter Emberclaw' }));
    expect(screen.getByTestId('inventory-filter-name')).toHaveTextContent('Emberclaw');
    expect(screen.getByTestId('inventory-hit-unavailable')).toHaveTextContent('true');
    expect(screen.getByTestId('filter-target-Emberclaw')).toHaveTextContent('yes');

    fireEvent.click(screen.getByRole('button', { name: 'Clear inventory filter' }));
    expect(screen.getByTestId('inventory-filter-name')).toHaveTextContent('none');
  });

  it('handles same-monster reorder drops through reorderCards mutation', async () => {
    renderWorkshop();
    fireEvent.click(screen.getByRole('button', { name: 'Reorder on Stonefang' }));

    await waitFor(() => {
      expect(workshopMock.reorderCards).toHaveBeenCalledWith({
        monsterName: 'Stonefang',
        fromIndex: 0,
        toIndex: 1,
      });
    });
  });
});

describe('WorkshopView: the workshop should not change things silently', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scrolls the inventory into view when a monster is tapped', () => {
    // Tapping a monster filters the inventory, which sits below the monster row and is
    // off-screen on a phone — so the filter applied where the player could not see it and
    // the tap read as doing nothing at all.
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const raf = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      });

    try {
      renderWorkshop();
      fireEvent.click(screen.getByRole('button', { name: 'Toggle filter Stonefang' }));
      expect(scrollIntoView).toHaveBeenCalled();
    } finally {
      raf.mockRestore();
    }
  });

  it('does not scroll when the filter is being turned off', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const raf = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      });

    try {
      renderWorkshop();
      const toggle = screen.getByRole('button', { name: 'Toggle filter Stonefang' });
      fireEvent.click(toggle);
      scrollIntoView.mockClear();
      fireEvent.click(toggle);
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      raf.mockRestore();
    }
  });

});
