import { useMemo } from 'react';
import { trpc } from '../lib/trpc.js';
import type { ItemSummary } from '../utils/item-tiers.js';

type WorkshopMonster = {
  name: string;
  type: string;
  level: number;
  dead: boolean;
  inRing: boolean;
  inEncounter: boolean;
  cardSlots: number;
  cards: string[];
  presets: Record<string, string[]>;
};

type WorkshopInventory = {
  monsters: WorkshopMonster[];
  unequippedDeck: string[];
  cardCompatibility: Record<string, string[]>;
  items: {
    character: ItemSummary[];
    monsters: Array<{ monsterName: string; items: ItemSummary[] }>;
  };
};

const EMPTY_INVENTORY: WorkshopInventory = {
  monsters: [],
  unequippedDeck: [],
  cardCompatibility: {},
  items: {
    character: [],
    monsters: [],
  },
};

export function useDeckWorkshop(roomId?: string) {
  const validRoomId = roomId ?? '';
  const utils = trpc.useUtils();

  const roomQuery = trpc.room.info.useQuery(
    { roomId: validRoomId },
    { enabled: !!roomId },
  );
  const inventoryQuery = trpc.game.myInventory.useQuery(
    { roomId: validRoomId },
    {
      enabled: !!roomId,
      refetchInterval: 30_000,
    },
  );

  const invalidateWorkshop = async () => {
    if (!roomId) return;
    await utils.game.myInventory.invalidate({ roomId });
    await utils.game.myMonsters.invalidate({ roomId });
  };

  const mutationOptions = { onSuccess: invalidateWorkshop } as const;
  const unequipCardMutation = trpc.game.unequipCard.useMutation(mutationOptions);
  const unequipManyMutation = trpc.game.unequipMany.useMutation(mutationOptions);
  const unequipAllMutation = trpc.game.unequipAll.useMutation(mutationOptions);
  const equipCardsMutation = trpc.game.equipCards.useMutation(mutationOptions);
  const moveCardMutation = trpc.game.moveCard.useMutation(mutationOptions);
  const moveManyMutation = trpc.game.moveMany.useMutation(mutationOptions);
  const savePresetMutation = trpc.game.savePreset.useMutation(mutationOptions);
  const loadPresetMutation = trpc.game.loadPreset.useMutation(mutationOptions);
  const deletePresetMutation = trpc.game.deletePreset.useMutation(mutationOptions);
  const reorderCardsMutation = trpc.game.reorderCards.useMutation(mutationOptions);
  const reviveMonsterMutation = trpc.game.reviveMonster.useMutation(mutationOptions);
  // Using an item can change a live fight (a heal mid-encounter), so the ring state is
  // refreshed alongside the inventory rather than waiting for the next poll.
  const useItemMutation = trpc.game.useItem.useMutation({
    onSuccess: async () => {
      await invalidateWorkshop();
      if (roomId) await utils.game.ringState.invalidate({ roomId });
    },
  });
  const sendMonsterToRingMutation = trpc.game.sendMonsterToRing.useMutation({
    onSuccess: async () => {
      await invalidateWorkshop();
      if (roomId) await utils.game.ringState.invalidate({ roomId });
    },
  });

  const inventory = (inventoryQuery.data ?? EMPTY_INVENTORY) as WorkshopInventory;
  const monsters = inventory.monsters ?? [];
  const unequippedDeck = inventory.unequippedDeck ?? [];
  const cardCompatibility = inventory.cardCompatibility ?? {};
  const items = inventory.items ?? EMPTY_INVENTORY.items;

  const loading = roomQuery.isLoading || inventoryQuery.isLoading;
  const busy = useMemo(
    () =>
      inventoryQuery.isFetching ||
      unequipCardMutation.isPending ||
      unequipManyMutation.isPending ||
      unequipAllMutation.isPending ||
      equipCardsMutation.isPending ||
      moveCardMutation.isPending ||
      moveManyMutation.isPending ||
      reorderCardsMutation.isPending ||
      savePresetMutation.isPending ||
      loadPresetMutation.isPending ||
      deletePresetMutation.isPending ||
      reviveMonsterMutation.isPending ||
      useItemMutation.isPending ||
      sendMonsterToRingMutation.isPending,
    [
      deletePresetMutation.isPending,
      reviveMonsterMutation.isPending,
      useItemMutation.isPending,
      sendMonsterToRingMutation.isPending,
      equipCardsMutation.isPending,
      inventoryQuery.isFetching,
      loadPresetMutation.isPending,
      moveCardMutation.isPending,
      moveManyMutation.isPending,
      reorderCardsMutation.isPending,
      savePresetMutation.isPending,
      unequipAllMutation.isPending,
      unequipCardMutation.isPending,
      unequipManyMutation.isPending,
    ],
  );

  return {
    roomName: roomQuery.data?.name,
    inventory,
    monsters,
    unequippedDeck,
    cardCompatibility,
    items,
    loading,
    busy,
    latestError:
      unequipCardMutation.error?.message ??
      unequipManyMutation.error?.message ??
      unequipAllMutation.error?.message ??
      equipCardsMutation.error?.message ??
      moveCardMutation.error?.message ??
      moveManyMutation.error?.message ??
      reorderCardsMutation.error?.message ??
      savePresetMutation.error?.message ??
      loadPresetMutation.error?.message ??
      deletePresetMutation.error?.message ??
      reviveMonsterMutation.error?.message ??
      useItemMutation.error?.message ??
      sendMonsterToRingMutation.error?.message,
    refresh: () => inventoryQuery.refetch(),
    reviveMonster: (input: { monsterName: string }) => {
      if (!roomId) throw new Error('Room not selected');
      return reviveMonsterMutation.mutateAsync({ roomId, ...input });
    },
    sendMonsterToRing: (input: { monsterName: string }) => {
      if (!roomId) throw new Error('Room not selected');
      return sendMonsterToRingMutation.mutateAsync({ roomId, ...input });
    },
    useItem: (input: {
      itemName: string;
      monsterName?: string;
      itemSource?: 'character' | 'monster';
    }) => {
      if (!roomId) throw new Error('Room not selected');
      return useItemMutation.mutateAsync({ roomId, ...input });
    },
    equipCards: (input: { monsterName: string; cardNames: string[]; replaceAll?: boolean }) => {
      if (!roomId) throw new Error('Room not selected');
      return equipCardsMutation.mutateAsync({ roomId, ...input });
    },
    unequipCard: (input: { monsterName: string; cardName: string; count?: number }) => {
      if (!roomId) throw new Error('Room not selected');
      return unequipCardMutation.mutateAsync({ roomId, ...input });
    },
    unequipMany: (input: {
      monsterName: string;
      cards: Array<{ cardName: string; count?: number }>;
    }) => {
      if (!roomId) throw new Error('Room not selected');
      return unequipManyMutation.mutateAsync({ roomId, ...input });
    },
    unequipAll: (input: { monsterName: string }) => {
      if (!roomId) throw new Error('Room not selected');
      return unequipAllMutation.mutateAsync({ roomId, ...input });
    },
    moveCard: (input: {
      cardName: string;
      fromMonsterName: string;
      toMonsterName: string;
      count?: number;
    }) => {
      if (!roomId) throw new Error('Room not selected');
      return moveCardMutation.mutateAsync({ roomId, ...input });
    },
    moveMany: (input: {
      fromMonsterName: string;
      toMonsterName: string;
      cards: Array<{ cardName: string; count?: number }>;
    }) => {
      if (!roomId) throw new Error('Room not selected');
      return moveManyMutation.mutateAsync({ roomId, ...input });
    },
    reorderCards: (input: {
      monsterName: string;
      fromIndex: number;
      toIndex: number;
    }) => {
      if (!roomId) throw new Error('Room not selected');
      return reorderCardsMutation.mutateAsync({ roomId, ...input });
    },
    savePreset: (input: { monsterName: string; presetName: string }) => {
      if (!roomId) throw new Error('Room not selected');
      return savePresetMutation.mutateAsync({ roomId, ...input });
    },
    loadPreset: (input: { monsterName: string; presetName: string }) => {
      if (!roomId) throw new Error('Room not selected');
      return loadPresetMutation.mutateAsync({ roomId, ...input });
    },
    deletePreset: (input: { monsterName: string; presetName: string }) => {
      if (!roomId) throw new Error('Room not selected');
      return deletePresetMutation.mutateAsync({ roomId, ...input });
    },
  };
}
