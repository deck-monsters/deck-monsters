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
      inRing: false,
      inEncounter: false,
      cardSlots: 2,
      cards: [],
      presets: {},
    },
  ],
  unequippedDeck: ['Hit'],
  loading: false,
  busy: false,
  latestError: null as string | null,
  equipCards: vi.fn(async () => ({ equippedCount: 1, requestedCount: 1, skippedCards: [] as string[] })),
  unequipCard: vi.fn(async () => ({ removedCount: 1, monsterName: 'Stonefang' })),
  unequipAll: vi.fn(async () => ({ removedCount: 0, monsterName: 'Stonefang' })),
  moveCard: vi.fn(async () => ({ movedCount: 1, fromMonsterName: 'Stonefang', toMonsterName: 'Emberclaw' })),
  savePreset: vi.fn(async () => undefined),
  loadPreset: vi.fn(async () => ({ equippedCount: 0, requestedCount: 0, skippedCards: [] as string[] })),
  deletePreset: vi.fn(async () => undefined),
  refresh: vi.fn(async () => undefined),
}));

vi.mock('../hooks/useDeckWorkshop.js', () => ({
  useDeckWorkshop: () => workshopMock,
}));

vi.mock('../components/AppShell.js', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../components/InventoryPanel.js', () => ({
  default: ({ onSelectCard }: { onSelectCard: (location: { kind: 'inventory' }, cardName: string, selectionId: string) => void }) => (
    <button
      type="button"
      onClick={() => onSelectCard({ kind: 'inventory' }, 'Hit', 'inventory:0')}
    >
      Select inventory card
    </button>
  ),
}));

vi.mock('../components/MonsterWorkshopPanel.js', () => ({
  default: ({
    monster,
    showSelectionHint,
    onDropCard,
  }: {
    monster: { name: string };
    showSelectionHint: boolean;
    onDropCard: (source: { kind: 'inventory' }, cardName: string) => Promise<void> | void;
  }) => (
    <section>
      <div data-testid={`hint-${monster.name}`}>{showSelectionHint ? 'hint-on' : 'hint-off'}</div>
      <button
        type="button"
        onClick={() => void onDropCard({ kind: 'inventory' }, 'Hit')}
      >
        Drop on {monster.name}
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
  });

  it('shows monster panel hints for inventory selections', () => {
    renderWorkshop();
    fireEvent.click(screen.getByRole('button', { name: 'Select inventory card' }));

    expect(screen.getByTestId('hint-Stonefang')).toHaveTextContent('hint-on');
    expect(screen.getByTestId('hint-Emberclaw')).toHaveTextContent('hint-on');
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
});
