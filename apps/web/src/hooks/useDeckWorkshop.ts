import { useMemo } from 'react';
import { trpc } from '../lib/trpc.js';
import type { ItemSummary } from '../utils/item-tiers.js';

type WorkshopMonster = {
  name: string;
  type: string;
  level: number;
  // Progress toward the next level, for the Workshop's level meter — see
  // docs/roadmap/11-balance-and-mechanics.md "Early progression front-loading" and
  // MonsterWorkshopPanel.tsx.
  xpIntoLevel: number;
  xpNeededForLevel: number;
  dead: boolean;
  inRing: boolean;
  inEncounter: boolean;
  cardSlots: number;
  cards: string[];
  presets: Record<string, string[]>;
  // See `InventoryMonsterSummary` in the server router — the workshop header's HP meter,
  // fallen-revive label, and fights count read straight off these.
  hp: number;
  maxHp: number;
  revivesAt: number | null;
  battles: { wins: number; losses: number; total: number };
};

type WorkshopInventory = {
  // "No character in this room yet" is not the same as "a character with no monsters",
  // and the workshop's first-run form depends on telling them apart.
  hasCharacter: boolean;
  monsters: WorkshopMonster[];
  unequippedDeck: string[];
  cardCompatibility: Record<string, string[]>;
  items: {
    character: ItemSummary[];
    monsters: Array<{ monsterName: string; items: ItemSummary[] }>;
  };
};

const EMPTY_INVENTORY: WorkshopInventory = {
  hasCharacter: false,
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
  const shopQuery = trpc.game.shop.useQuery(
    { roomId: validRoomId },
    { enabled: !!roomId, refetchInterval: 30_000 },
  );
  const spawnOptionsQuery = trpc.game.spawnOptions.useQuery(
    { roomId: validRoomId },
    { enabled: !!roomId, staleTime: Infinity },
  );
  /*
   * Only a player without a character needs these, and they are what the engine's
   * creation prompts would have asked for — the workshop's spawn mutation is prompt-free
   * (docs/engine-concurrency-and-timing.md), so the answers come from the form instead.
   * The avatar list is random per request, which is what makes "Shuffle" a refetch.
   */
  const characterCreationQuery = trpc.game.characterCreationChoices.useQuery(
    { roomId: validRoomId },
    { enabled: !!roomId && inventoryQuery.data?.hasCharacter === false, staleTime: Infinity },
  );
  const invalidateWorkshop = async () => {
    if (!roomId) return;
    await utils.game.myInventory.invalidate({ roomId });
    await utils.game.myMonsters.invalidate({ roomId });
  };

  const flowStatusQuery = trpc.game.flowStatus.useQuery(
    { roomId: validRoomId },
    { enabled: !!roomId, refetchInterval: 3_000 },
  );
  const cancelFlowMutation = trpc.game.cancelFlow.useMutation({
    onSuccess: async () => {
      await flowStatusQuery.refetch();
      await invalidateWorkshop();
    },
  });

  const mutationOptions = { onSuccess: invalidateWorkshop } as const;
  const buyShopItemMutation = trpc.game.buyShopItem.useMutation({
    onSuccess: async () => {
      await invalidateWorkshop();
      if (roomId) await shopQuery.refetch();
    },
  });
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
  const spawnMonsterMutation = trpc.game.spawnMonster.useMutation(mutationOptions);
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

  const loading = roomQuery.isLoading || inventoryQuery.isLoading || shopQuery.isLoading || spawnOptionsQuery.isLoading;
  const consoleFlowActive = flowStatusQuery.data?.consoleActive ?? false;
  const busy = useMemo(
    () =>
      consoleFlowActive ||
      inventoryQuery.isFetching ||
      shopQuery.isFetching ||
      buyShopItemMutation.isPending ||
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
      spawnMonsterMutation.isPending ||
      useItemMutation.isPending ||
      sendMonsterToRingMutation.isPending,
    [
      consoleFlowActive,
      deletePresetMutation.isPending,
      reviveMonsterMutation.isPending,
      spawnMonsterMutation.isPending,
      useItemMutation.isPending,
      sendMonsterToRingMutation.isPending,
      equipCardsMutation.isPending,
      inventoryQuery.isFetching,
      shopQuery.isFetching,
      buyShopItemMutation.isPending,
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
    hasCharacter: inventoryQuery.data?.hasCharacter,
    characterCreation: characterCreationQuery.data ?? { pronouns: [], avatars: [], suggestedName: '' },
    shuffleAvatars: () => characterCreationQuery.refetch(),
    monsters,
    unequippedDeck,
    cardCompatibility,
    items,
    shop: shopQuery.data,
    spawnOptions: spawnOptionsQuery.data ?? { types: [], pronouns: [] },
    loading,
    busy,
    consoleFlowActive,
    pendingPrompt: flowStatusQuery.data?.pendingPrompt ?? null,
    cancelConsoleFlow: async () => {
      if (!roomId) throw new Error('Room not selected');
      return cancelFlowMutation.mutateAsync({ roomId });
    },
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
      spawnMonsterMutation.error?.message ??
      useItemMutation.error?.message ??
      sendMonsterToRingMutation.error?.message ??
      buyShopItemMutation.error?.message,
    refresh: () => Promise.all([inventoryQuery.refetch(), shopQuery.refetch()]),
    spawnMonster: (input: {
      type: number;
      gender: 'male' | 'female' | 'androgynous';
      name: string;
      color: string;
      // First run only: the server creates the character in the same mutation.
      character?: { name: string; gender: 'male' | 'female' | 'androgynous'; avatar: string };
    }) => {
      if (!roomId) throw new Error('Room not selected');
      return spawnMonsterMutation.mutateAsync({ roomId, ...input });
    },
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
    buyShopItem: (input: {
      section: 'items' | 'backRoom' | 'cards';
      stockIndex: number;
      expectedItemType: string;
      expectedClosingTime: string;
    }) => {
      if (!roomId) throw new Error('Room not selected');
      return buyShopItemMutation.mutateAsync({ roomId, ...input });
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
