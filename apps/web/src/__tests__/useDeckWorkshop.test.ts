import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const inventoryInvalidate = vi.fn(async () => undefined);
  const monstersInvalidate = vi.fn(async () => undefined);
  const roomInfoUseQuery = vi.fn();
  const myInventoryUseQuery = vi.fn();
  const defaultMutation = vi.fn((options?: { onSuccess?: () => Promise<void> }) => ({
    isPending: false,
    error: null,
    mutateAsync: vi.fn(async () => {
      await options?.onSuccess?.();
      return { equippedCount: 1, requestedCount: 1, skippedCards: [] };
    }),
  }));

  return {
    inventoryInvalidate,
    monstersInvalidate,
    roomInfoUseQuery,
    myInventoryUseQuery,
    unequipCardUseMutation: vi.fn(defaultMutation),
    unequipManyUseMutation: vi.fn(defaultMutation),
    unequipAllUseMutation: vi.fn(defaultMutation),
    equipCardsUseMutation: vi.fn(defaultMutation),
    moveCardUseMutation: vi.fn(defaultMutation),
    moveManyUseMutation: vi.fn(defaultMutation),
    savePresetUseMutation: vi.fn(defaultMutation),
    loadPresetUseMutation: vi.fn(defaultMutation),
    deletePresetUseMutation: vi.fn(defaultMutation),
    reorderCardsUseMutation: vi.fn(defaultMutation),
  };
});

vi.mock('../lib/trpc.js', () => ({
  trpc: {
    useUtils: () => ({
      game: {
        myInventory: { invalidate: mocks.inventoryInvalidate },
        myMonsters: { invalidate: mocks.monstersInvalidate },
      },
    }),
    room: {
      info: {
        useQuery: mocks.roomInfoUseQuery,
      },
    },
    game: {
      myInventory: {
        useQuery: mocks.myInventoryUseQuery,
      },
      unequipCard: { useMutation: mocks.unequipCardUseMutation },
      unequipMany: { useMutation: mocks.unequipManyUseMutation },
      unequipAll: { useMutation: mocks.unequipAllUseMutation },
      equipCards: { useMutation: mocks.equipCardsUseMutation },
      moveCard: { useMutation: mocks.moveCardUseMutation },
      moveMany: { useMutation: mocks.moveManyUseMutation },
      savePreset: { useMutation: mocks.savePresetUseMutation },
      loadPreset: { useMutation: mocks.loadPresetUseMutation },
      deletePreset: { useMutation: mocks.deletePresetUseMutation },
      reorderCards: { useMutation: mocks.reorderCardsUseMutation },
    },
  },
}));

import { useDeckWorkshop } from '../hooks/useDeckWorkshop.js';

describe('useDeckWorkshop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.roomInfoUseQuery.mockReturnValue({
      data: { name: 'Test Room' },
      isLoading: false,
    });
    mocks.myInventoryUseQuery.mockReturnValue({
      data: { monsters: [], unequippedDeck: [], cardCompatibility: {}, items: { character: [], monsters: [] } },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
  });

  it('invalidates inventory and monster queries after successful mutation', async () => {
    const { result } = renderHook(() => useDeckWorkshop('room-123'));

    await act(async () => {
      await result.current.equipCards({
        monsterName: 'Stonefang',
        cardNames: ['Hit'],
      });
    });

    expect(mocks.inventoryInvalidate).toHaveBeenCalledWith({ roomId: 'room-123' });
    expect(mocks.monstersInvalidate).toHaveBeenCalledWith({ roomId: 'room-123' });
  });

  it('throws when room is missing for mutation calls', async () => {
    const { result } = renderHook(() => useDeckWorkshop(undefined));

    expect(() =>
      result.current.equipCards({
        monsterName: 'Stonefang',
        cardNames: ['Hit'],
      }),
    ).toThrow('Room not selected');
  });

  it('sends unequipMany as a single mutation carrying the full card list', async () => {
    const { result } = renderHook(() => useDeckWorkshop('room-123'));

    await act(async () => {
      await result.current.unequipMany({
        monsterName: 'Stonefang',
        cards: [
          { cardName: 'Hit', count: 2 },
          { cardName: 'Heal', count: 1 },
        ],
      });
    });

    const mutateAsync = mocks.unequipManyUseMutation.mock.results[0]?.value.mutateAsync;
    expect(mutateAsync).toHaveBeenCalledWith({
      roomId: 'room-123',
      monsterName: 'Stonefang',
      cards: [
        { cardName: 'Hit', count: 2 },
        { cardName: 'Heal', count: 1 },
      ],
    });
    expect(mocks.inventoryInvalidate).toHaveBeenCalledWith({ roomId: 'room-123' });
  });

  it('sends moveMany as a single mutation carrying the full card list', async () => {
    const { result } = renderHook(() => useDeckWorkshop('room-123'));

    await act(async () => {
      await result.current.moveMany({
        fromMonsterName: 'Stonefang',
        toMonsterName: 'Mirebell',
        cards: [{ cardName: 'Hit', count: 2 }],
      });
    });

    const mutateAsync = mocks.moveManyUseMutation.mock.results[0]?.value.mutateAsync;
    expect(mutateAsync).toHaveBeenCalledWith({
      roomId: 'room-123',
      fromMonsterName: 'Stonefang',
      toMonsterName: 'Mirebell',
      cards: [{ cardName: 'Hit', count: 2 }],
    });
  });
});
