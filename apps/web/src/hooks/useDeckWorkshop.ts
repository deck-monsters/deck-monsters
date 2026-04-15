import { useMemo } from 'react';
import { trpc } from '../lib/trpc.js';

type WorkshopMonster = {
  name: string;
  type: string;
  level: number;
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
    character: string[];
    monsters: Array<{ monsterName: string; items: string[] }>;
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
  const unequipAllMutation = trpc.game.unequipAll.useMutation(mutationOptions);
  const equipCardsMutation = trpc.game.equipCards.useMutation(mutationOptions);
  const moveCardMutation = trpc.game.moveCard.useMutation(mutationOptions);
  const savePresetMutation = trpc.game.savePreset.useMutation(mutationOptions);
  const loadPresetMutation = trpc.game.loadPreset.useMutation(mutationOptions);
  const deletePresetMutation = trpc.game.deletePreset.useMutation(mutationOptions);
  const reorderCardsMutation = trpc.game.reorderCards.useMutation(mutationOptions);

  const inventory = (inventoryQuery.data ?? EMPTY_INVENTORY) as WorkshopInventory;
  const monsters = inventory.monsters ?? [];
  const unequippedDeck = inventory.unequippedDeck ?? [];
  const cardCompatibility = inventory.cardCompatibility ?? {};

  const loading = roomQuery.isLoading || inventoryQuery.isLoading;
  const busy = useMemo(
    () =>
      inventoryQuery.isFetching ||
      unequipCardMutation.isPending ||
      unequipAllMutation.isPending ||
      equipCardsMutation.isPending ||
      moveCardMutation.isPending ||
      reorderCardsMutation.isPending ||
      savePresetMutation.isPending ||
      loadPresetMutation.isPending ||
      deletePresetMutation.isPending,
    [
      deletePresetMutation.isPending,
      equipCardsMutation.isPending,
      inventoryQuery.isFetching,
      loadPresetMutation.isPending,
      moveCardMutation.isPending,
      reorderCardsMutation.isPending,
      savePresetMutation.isPending,
      unequipAllMutation.isPending,
      unequipCardMutation.isPending,
    ],
  );

  return {
    roomName: roomQuery.data?.name,
    inventory,
    monsters,
    unequippedDeck,
    cardCompatibility,
    loading,
    busy,
    latestError:
      unequipCardMutation.error?.message ??
      unequipAllMutation.error?.message ??
      equipCardsMutation.error?.message ??
      moveCardMutation.error?.message ??
      reorderCardsMutation.error?.message ??
      savePresetMutation.error?.message ??
      loadPresetMutation.error?.message ??
      deletePresetMutation.error?.message,
    refresh: () => inventoryQuery.refetch(),
    equipCards: (input: { monsterName: string; cardNames: string[]; replaceAll?: boolean }) => {
      if (!roomId) throw new Error('Room not selected');
      return equipCardsMutation.mutateAsync({ roomId, ...input });
    },
    unequipCard: (input: { monsterName: string; cardName: string; count?: number }) => {
      if (!roomId) throw new Error('Room not selected');
      return unequipCardMutation.mutateAsync({ roomId, ...input });
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
