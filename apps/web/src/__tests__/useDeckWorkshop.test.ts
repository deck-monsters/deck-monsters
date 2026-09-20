import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const inventoryInvalidate = vi.fn(async () => undefined);
  const monstersInvalidate = vi.fn(async () => undefined);
  const ringStateInvalidate = vi.fn(async () => undefined);
  const roomInfoUseQuery = vi.fn();
  const myInventoryUseQuery = vi.fn();
  const shopUseQuery = vi.fn();
  const spawnOptionsUseQuery = vi.fn();
  const characterCreationUseQuery = vi.fn();
	const flowStatusUseQuery = vi.fn();
  const inventoryRefetch = vi.fn(async () => undefined);
  const shopRefetch = vi.fn(async () => undefined);
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
    ringStateInvalidate,
    roomInfoUseQuery,
    myInventoryUseQuery,
    shopUseQuery,
    spawnOptionsUseQuery,
    characterCreationUseQuery,
	flowStatusUseQuery,
    inventoryRefetch,
    shopRefetch,
    buyShopItemUseMutation: vi.fn(defaultMutation),
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
    reviveMonsterUseMutation: vi.fn(defaultMutation),
    spawnMonsterUseMutation: vi.fn(defaultMutation),
    sendMonsterToRingUseMutation: vi.fn(defaultMutation),
    useItemUseMutation: vi.fn(defaultMutation),
	cancelFlowUseMutation: vi.fn(defaultMutation),
  };
});

vi.mock('../lib/trpc.js', () => ({
  trpc: {
    useUtils: () => ({
      game: {
        myInventory: { invalidate: mocks.inventoryInvalidate },
        myMonsters: { invalidate: mocks.monstersInvalidate },
        ringState: { invalidate: mocks.ringStateInvalidate },
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
      shop: { useQuery: mocks.shopUseQuery },
      spawnOptions: { useQuery: mocks.spawnOptionsUseQuery },
      characterCreationChoices: { useQuery: mocks.characterCreationUseQuery },
	  flowStatus: { useQuery: mocks.flowStatusUseQuery },
	  cancelFlow: { useMutation: mocks.cancelFlowUseMutation },
      buyShopItem: { useMutation: mocks.buyShopItemUseMutation },
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
      reviveMonster: { useMutation: mocks.reviveMonsterUseMutation },
      spawnMonster: { useMutation: mocks.spawnMonsterUseMutation },
      sendMonsterToRing: { useMutation: mocks.sendMonsterToRingUseMutation },
      useItem: { useMutation: mocks.useItemUseMutation },
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
      data: { hasCharacter: true, monsters: [], unequippedDeck: [], cardCompatibility: {}, items: { character: [], monsters: [] } },
      isLoading: false,
      isFetching: false,
      refetch: mocks.inventoryRefetch,
    });
    mocks.shopUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      refetch: mocks.shopRefetch,
    });
    mocks.spawnOptionsUseQuery.mockReturnValue({
      data: {
        types: [{ index: 0, label: 'Basilisk' }, { index: 2, label: 'Jinn' }],
        pronouns: [
          { key: 'male', label: 'he/him' },
          { key: 'female', label: 'she/her' },
          { key: 'androgynous', label: 'they/them' },
        ],
      },
      isLoading: false,
    });
    mocks.characterCreationUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      refetch: vi.fn(async () => undefined),
    });
	mocks.flowStatusUseQuery.mockReturnValue({
	  data: { consoleActive: false, workshopActive: false, pendingPrompt: null },
	  refetch: vi.fn(async () => undefined),
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

  it('exposes the complete command-free Workshop journey', async () => {
    const { result } = renderHook(() => useDeckWorkshop('room-123'));

    await act(async () => {
      await result.current.spawnMonster({
        type: 2,
        gender: 'female',
        name: 'Saffron',
        color: 'violet smoke',
      });
      await result.current.equipCards({ monsterName: 'Saffron', cardNames: ['Hit'] });
      await result.current.reviveMonster({ monsterName: 'Saffron' });
      await result.current.sendMonsterToRing({ monsterName: 'Saffron' });
      await result.current.useItem({ itemName: 'Healing Potion', monsterName: 'Saffron', itemSource: 'monster' });
      await result.current.buyShopItem({
        section: 'items',
        stockIndex: 0,
        expectedItemType: 'Healing Potion',
        expectedClosingTime: '2026-09-18T00:00:00.000Z',
      });
    });

    expect(mocks.spawnMonsterUseMutation.mock.results[0]?.value.mutateAsync).toHaveBeenCalledWith({
      roomId: 'room-123', type: 2, gender: 'female', name: 'Saffron', color: 'violet smoke',
    });
    expect(mocks.reviveMonsterUseMutation.mock.results[0]?.value.mutateAsync).toHaveBeenCalledWith({
      roomId: 'room-123', monsterName: 'Saffron',
    });
    expect(mocks.sendMonsterToRingUseMutation.mock.results[0]?.value.mutateAsync).toHaveBeenCalledWith({
      roomId: 'room-123', monsterName: 'Saffron',
    });
    expect(mocks.useItemUseMutation.mock.results[0]?.value.mutateAsync).toHaveBeenCalledWith({
      roomId: 'room-123', itemName: 'Healing Potion', monsterName: 'Saffron', itemSource: 'monster',
    });
    expect(mocks.buyShopItemUseMutation.mock.results[0]?.value.mutateAsync).toHaveBeenCalledWith({
      roomId: 'room-123', section: 'items', stockIndex: 0,
      expectedItemType: 'Healing Potion', expectedClosingTime: '2026-09-18T00:00:00.000Z',
    });
  });

  it('refreshes inventory and the rotating shop together', async () => {
    const { result } = renderHook(() => useDeckWorkshop('room-123'));

    await act(async () => {
      await result.current.refresh();
    });

    expect(mocks.inventoryRefetch).toHaveBeenCalledOnce();
    expect(mocks.shopRefetch).toHaveBeenCalledOnce();
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

  it('keeps character presence unknown until the inventory query resolves', () => {
    mocks.myInventoryUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      refetch: mocks.inventoryRefetch,
    });

    const { result } = renderHook(() => useDeckWorkshop('room-123'));

    expect(result.current.hasCharacter).toBeUndefined();
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
