import { randomUUID } from 'node:crypto';

import { z } from 'zod';
import { TRPCError, tracked } from '@trpc/server';
import { createLogger } from '../logger.js';

const log = createLogger('router');

import type { GameEvent, EventType, EventScope } from '@deck-monsters/engine';
import {
	PRONOUNS,
	PROMPT_CANCELLED,
	PromptCancelledError,
	allMonsters,
	getXpCapForLevel,
	isCommandRefusal,
	purchaseShopItem,
	randomAvatarChoices,
	type ShopItemSection,
} from '@deck-monsters/engine';
import { buildQuickActions } from '../quick-actions.js';
import { t } from './trpc.js';
import { protectedProcedure, serviceProcedure } from './middleware.js';
import type { RoomManager } from '../room-manager.js';
import { ensureConnectorUser } from '../auth/connector-users.js';
import { publicDisplayName } from '../public-display-name.js';
import { createProfileRouter } from './profile.js';
import {
	commandsTotal,
	wsConnectionsActive,
	ringFeedReplayFromDbTotal,
	ringFeedReplayGapTotal,
} from '../metrics/index.js';
import { db } from '../db/index.js';
import {
	loadFightEventsForSummary,
	queryFightByNumber,
	queryMonsterFightHistory,
	queryRecentFights,
	queryGlobalMonsters,
	queryGlobalPlayers,
	queryRoomMonsters,
	queryRoomPlayers,
	buildCatchUpText,
	computeMonsterWinStreaks,
	formatCatchUpStreakLines,
	formatSinceLabel,
	getMemberLastSeen,
	monsterIdsFromSummaries,
	queryFightsSince,
	STREAK_MIN,
	touchMemberLastSeen,
	type LeaderboardSort,
} from '../analytics-queries.js';

type InventoryMonsterSummary = {
	name: string;
	type: string;
	level: number;
	// XP progress toward the next level, for the Workshop's level meter (see
	// docs/roadmap/11-balance-and-mechanics.md "Early progression front-loading").
	// `xpIntoLevel`/`xpNeededForLevel` (rather than raw cumulative xp) so the client can
	// draw a 0-100% bar without re-implementing the engine's level curve.
	xpIntoLevel: number;
	xpNeededForLevel: number;
	dead: boolean;
	inRing: boolean;
	inEncounter: boolean;
	cardSlots: number;
	cards: string[];
	presets: Record<string, string[]>;
	// Current/max HP for the Workshop header (10b-bugs-fixed.md — the deck-slot bar was
	// full nearly all the time and the one number a beastmaster actually needs, current
	// HP, was not shown anywhere). `hp` is clamped at 0 for display: the engine can drive
	// it negative on an overkill hit before `die()` clamps it back, and a raw negative
	// would render an inverted/overflowing bar.
	hp: number;
	maxHp: number;
	// Epoch ms when a fallen monster's revival completes, or null when the monster is
	// alive, or dead with no revival timer running (e.g. permadeath, or the process
	// restarted and the respawn timeout must be rescheduled). A restored timer's length is
	// only its remaining delay, so the engine exposes the dedicated `respawnAt` completion
	// epoch instead. Never send the timer handle or timeout length itself over the wire.
	revivesAt: number | null;
	battles: { wins: number; losses: number; total: number };
};

// Per-item summary for the web item list (roadmap/19-player-agency-and-items.md §7).
// Usability is computed here, once, from the engine's own `canUseItem` predicate so the
// client never has to reimplement the rule — see `canUseItemSafe` below.
type ItemSummary = {
	displayName: string;
	expired: boolean;
	// The engine's own rendered uses-remaining text ("Usable 1 time." / "N times" /
	// "All used up!") so the client doesn't need to reconstruct it from numberOfUses/used.
	stats: string;
	// Names of the player's own monsters this item currently passes `canUseItem` for.
	// Combined with `InventoryMonsterSummary.inRing`, the client can sort into the three
	// tiers (usable now / owned-but-not-here / spent) without any game-rule knowledge.
	usableOnMonsters: string[];
	// Whether the character can use this item on themself (`usableWithoutMonster` items).
	usableOnCharacter: boolean;
	// This item's own action asks a question (the Sorting Hat asks which team), so it can
	// only be used where a prompt can be answered. `useItem` runs on a prompt-free channel
	// that rejects questions, so the client must not offer these as usable from the web —
	// it would confirm and then fail every time.
	requiresPrompt: boolean;
};

type InventorySummary = {
	// Whether this member has a character in this room at all. Without it the web could
	// not tell "no character yet" from "character with no monsters", and so could not
	// offer first-run character creation — see `spawnMonster`'s `character` input.
	hasCharacter: boolean;
	monsters: InventoryMonsterSummary[];
	unequippedDeck: string[];
	cardCompatibility: Record<string, string[]>;
	items: {
		character: ItemSummary[];
		monsters: Array<{ monsterName: string; items: ItemSummary[] }>;
	};
};

type ShopItemSummary = {
	stockIndex: number;
	stockCount: number;
	section: ShopItemSection;
	displayName: string;
	description: string;
	stats: string;
	price: number;
	affordable: boolean;
	ownedCount: number;
};

const reorderCardsResultSchema = z.object({
	monsterName: z.string().min(1),
	fromIndex: z.number().int().min(0),
	toIndex: z.number().int().min(0),
	cards: z.array(z.string()),
});

type PublishableEvent = {
	type: EventType;
	scope: EventScope;
	text: string;
	payload: Record<string, unknown>;
	targetUserId?: string;
};

type EventBusPublisher = {
	publish: (event: PublishableEvent) => unknown;
};

const getDisplayName = (entity: unknown): string => {
	if (!entity || typeof entity !== 'object') return 'Unknown';
	const entry = entity as Record<string, unknown>;
	const byItemType = typeof entry.itemType === 'string' ? entry.itemType : undefined;
	const byCardType = typeof entry.cardType === 'string' ? entry.cardType : undefined;
	const byName = typeof entry.name === 'string' ? entry.name : undefined;
	return byItemType ?? byCardType ?? byName ?? 'Unknown';
};

type SummarizableShop = {
	name: unknown;
	adjective: unknown;
	closingTime: string | number | Date;
	priceOffset: number;
	backRoomOffset: number;
	items: unknown[];
	backRoom: unknown[];
	cards: unknown[];
};

const summarizeShop = (
	game: { shop: SummarizableShop },
	character: { items?: unknown[]; deck?: unknown[]; coins?: number },
) => {
	const shop = game.shop;
	const ownedItems = Array.isArray(character?.items) ? character.items : [];
	const ownedCards = Array.isArray(character?.deck) ? character.deck : [];
	const coins = typeof character?.coins === 'number' ? character.coins : 0;
	// `ownershipPool` lets cards count against the character's deck rather than their
	// pocket items — the two inventories are otherwise unrelated, and counting a card
	// against `character.items` would always read as "own 0" even when the player is
	// carrying several.
	const summarizeStock = (
		section: ShopItemSection,
		stock: unknown[],
		offset: number,
		ownershipPool: unknown[],
	): ShopItemSummary[] => {
		const summaries = new Map<string, ShopItemSummary>();
		stock.forEach((item, stockIndex) => {
			const record = (item ?? {}) as Record<string, unknown>;
			const displayName = getDisplayName(item);
			const price = Math.round((typeof record.cost === 'number' ? record.cost : 0) * offset);
			const key = `${displayName}\u0000${price}\u0000${String(record.description ?? '')}\u0000${String(record.stats ?? '')}`;
			const existing = summaries.get(key);
			if (existing) {
				existing.stockCount += 1;
				return;
			}
			summaries.set(key, {
				stockIndex,
				stockCount: 1,
				section,
				displayName,
				description: typeof record.description === 'string' ? record.description : '',
				stats: typeof record.stats === 'string' ? record.stats : '',
				price,
				affordable: price <= coins,
				ownedCount: ownershipPool.filter((owned: unknown) => getDisplayName(owned) === displayName).length,
			});
		});
		return [...summaries.values()];
	};

	// Cards price at the same offset as standard items (`priceOffset * 2`) — see
	// `items/store/buy.ts`'s console flow, which uses that identical multiplier whether
	// the player picked "Items" or "Cards" from the shop menu. Only the back room has its
	// own steeper offset.
	const itemsAndCardsOffset = shop.priceOffset * 2;

	return {
		name: String(shop.name),
		adjective: String(shop.adjective),
		closingTime: new Date(shop.closingTime).toISOString(),
		coins,
		items: summarizeStock('items', shop.items, itemsAndCardsOffset, ownedItems),
		cards: summarizeStock('cards', Array.isArray(shop.cards) ? shop.cards : [], itemsAndCardsOffset, ownedCards),
		backRoom: summarizeStock('backRoom', shop.backRoom, shop.backRoomOffset, ownedItems),
	};
};

const canMonsterHoldCard = (monster: unknown, card: unknown): boolean => {
	if (!monster || typeof monster !== 'object') return false;
	const canHoldCard = (monster as { canHoldCard?: unknown }).canHoldCard;
	if (typeof canHoldCard !== 'function') {
		// Test doubles and legacy snapshots may not provide this function.
		return true;
	}
	try {
		return Boolean(canHoldCard.call(monster, card));
	} catch {
		return false;
	}
};

// Mirrors `canMonsterHoldCard`'s defensive pattern: test doubles and legacy save-state
// snapshots do not always provide `canUseItem`. Unlike `canMonsterHoldCard` (which degrades
// to `true` because cards are assumed compatible until proven otherwise), this degrades to
// `false` — an item list must never claim an item is usable somewhere the engine can't
// confirm, since that claim drives a live "tap to use" affordance in a fight.
const canUseItemSafe = (entity: unknown, item: unknown): boolean => {
	if (!entity || typeof entity !== 'object') return false;
	const canUseItem = (entity as { canUseItem?: unknown }).canUseItem;
	if (typeof canUseItem !== 'function') {
		return false;
	}
	try {
		return Boolean(canUseItem.call(entity, item));
	} catch {
		return false;
	}
};

const summarizeItem = (
	item: unknown,
	monsterEntries: Array<{ monster: unknown; summary: InventoryMonsterSummary }>,
	character: unknown,
): ItemSummary => {
	const record = (item ?? {}) as Record<string, unknown>;
	// `expired` is a derived getter (`used >= numberOfUses`) on real items; a test double or
	// legacy snapshot missing it is treated as "not expired" rather than throwing or hiding
	// the item, matching the file's degrade-to-sensible-default style.
	const expired = typeof record.expired === 'boolean' ? record.expired : false;
	const stats =
		typeof record.stats === 'string'
			? record.stats
			: expired
				? 'All used up!'
				: 'Usable an unlimited number of times.';

	return {
		displayName: getDisplayName(item),
		expired,
		stats,
		usableOnMonsters: monsterEntries
			.filter((entry) => canUseItemSafe(entry.monster, item))
			.map((entry) => entry.summary.name),
		usableOnCharacter: canUseItemSafe(character, item),
		requiresPrompt: typeof record.requiresPrompt === 'boolean' ? record.requiresPrompt : false,
	};
};

const summarizeInventory = ({
	character,
	inRing,
}: {
	character: Record<string, unknown>;
	inRing: Set<unknown>;
}): InventorySummary => {
	const monsters = Array.isArray(character.monsters) ? character.monsters : [];
	const deck = Array.isArray(character.deck) ? character.deck : [];
	const items = Array.isArray(character.items) ? character.items : [];

	const monsterEntries = monsters
		.map((monster) => {
			const record = (monster ?? {}) as Record<string, unknown>;
			const cards = Array.isArray(record.cards) ? record.cards : [];
			const presetsRaw = (record.options as Record<string, unknown> | undefined)?.presets;
			const presets = Object.entries(
				(typeof presetsRaw === 'object' && presetsRaw !== null
					? presetsRaw
					: {}) as Record<string, unknown>,
			).reduce<Record<string, string[]>>((all, [presetName, presetCards]) => {
				if (!Array.isArray(presetCards)) return all;
				all[presetName] = presetCards
					.filter((card): card is string => typeof card === 'string')
					.slice();
				return all;
			}, {});

			const name = typeof record.givenName === 'string' ? record.givenName.trim() : '';
			if (!name) return null;

			const level =
				typeof record.level === 'number' && Number.isFinite(record.level) ? record.level : 0;
			const xp = typeof record.xp === 'number' && Number.isFinite(record.xp) ? record.xp : 0;
			// `getXpCapForLevel(N)` is the highest xp that still maps to level N (see
			// ring/index.ts) — the floor of the current level's bracket is one past the
			// previous level's cap, and the bracket's size is what the meter fills toward.
			const levelFloor = level > 0 ? getXpCapForLevel(level - 1) + 1 : 0;
			const levelCap = getXpCapForLevel(level);
			const xpIntoLevel = Math.max(0, xp - levelFloor);
			const xpNeededForLevel = Math.max(1, levelCap - levelFloor + 1);

			const dead = Boolean(record.dead);
			const rawHp = typeof record.hp === 'number' && Number.isFinite(record.hp) ? record.hp : 0;
			const maxHp = Math.max(
				1,
				typeof record.maxHp === 'number' && Number.isFinite(record.maxHp) ? record.maxHp : 1,
			);
			const respawnAt =
				typeof record.respawnAt === 'number' && Number.isFinite(record.respawnAt)
					? record.respawnAt
					: undefined;
			const revivesAt =
				dead && respawnAt !== undefined
					? respawnAt
					: null;
			const battlesRaw = record.battles as Record<string, unknown> | undefined;
			const battles = {
				wins: typeof battlesRaw?.wins === 'number' && Number.isFinite(battlesRaw.wins) ? battlesRaw.wins : 0,
				losses:
					typeof battlesRaw?.losses === 'number' && Number.isFinite(battlesRaw.losses)
						? battlesRaw.losses
						: 0,
				total:
					typeof battlesRaw?.total === 'number' && Number.isFinite(battlesRaw.total)
						? battlesRaw.total
						: 0,
			};

			return {
				monster,
				summary: {
					name,
					type:
						typeof record.creatureType === 'string'
							? record.creatureType
							: 'Unknown',
					level,
					xpIntoLevel,
					xpNeededForLevel,
					dead,
					inRing: inRing.has(monster),
					inEncounter: Boolean(record.inEncounter),
					cardSlots:
						typeof record.cardSlots === 'number' && Number.isFinite(record.cardSlots)
							? record.cardSlots
							: 0,
					cards: cards.map((card) => getDisplayName(card)),
					presets,
					hp: Math.min(maxHp, Math.max(0, rawHp)),
					maxHp,
					revivesAt,
					battles,
				} satisfies InventoryMonsterSummary,
			};
		})
		.filter(
			(
				monsterEntry,
			): monsterEntry is { monster: unknown; summary: InventoryMonsterSummary } =>
				monsterEntry !== null,
		);

	const monsterSummaries = monsterEntries.map((entry) => entry.summary);

	const monsterItems = monsterEntries.map((entry) => {
		const monster = (entry.monster ?? {}) as Record<string, unknown>;
		const monsterInventory = Array.isArray(monster.items) ? monster.items : [];
		return {
			monsterName: entry.summary.name,
			items: monsterInventory.map((item) => summarizeItem(item, monsterEntries, character)),
		};
	});

	const cardCompatibility = deck.reduce<Record<string, string[]>>((all, card) => {
		const cardName = getDisplayName(card);
		if (!all[cardName]) {
			all[cardName] = [];
		}
		for (const entry of monsterEntries) {
			if (!canMonsterHoldCard(entry.monster, card)) continue;
			if (!all[cardName]?.includes(entry.summary.name)) {
				all[cardName]?.push(entry.summary.name);
			}
		}
		return all;
	}, {});

	return {
		hasCharacter: true,
		monsters: monsterSummaries,
		unequippedDeck: deck.map((card) => getDisplayName(card)),
		cardCompatibility,
		items: {
			character: items.map((item) => summarizeItem(item, monsterEntries, character)),
			monsters: monsterItems,
		},
	};
};

const getMonsterCardsByName = ({
	character,
	monsterName,
}: {
	character: Record<string, unknown>;
	monsterName: string;
}): string[] => {
	const monsters = Array.isArray(character.monsters) ? character.monsters : [];
	const match = monsters.find((monster) => {
		const name = (monster as Record<string, unknown> | undefined)?.givenName;
		return typeof name === 'string' && name.toLowerCase() === monsterName.toLowerCase();
	}) as Record<string, unknown> | undefined;
	const cards = Array.isArray(match?.cards) ? match.cards : [];
	return cards.map((card) => getDisplayName(card));
};

const publishPrivateAnnouncement = ({
	eventBus,
	userId,
	text,
	operation,
}: {
	eventBus: EventBusPublisher;
	userId: string;
	text: string;
	operation: string;
}): void => {
	eventBus.publish({
		type: 'announce',
		scope: 'private',
		targetUserId: userId,
		text,
		payload: {
			source: 'workshop',
			operation,
		},
	});
};

export type AppRouter = ReturnType<typeof createRouter>;

// Increment when the client<->server protocol changes in a breaking way.
const PROTOCOL_VERSION = 1;
const BUILD_VERSION = process.env['BUILD_VERSION'] ?? 'dev';

// Per-user active-flow lock.  Key = `${roomId}:${userId}`, value = the owning
// flow's commandId. While a command flow is in progress for a given user+room,
// further commands are rejected with a friendly message so users know to
// answer the prompt first. Exported so it can be inspected in unit tests.
//
// The value is an ownership token, not just presence: a flow's `.finally()`
// only clears the lock if it still owns it. Without that check there is a
// cancellation race — `cancelFlow` deletes the key immediately, so if command
// B starts before cancelled command A's promise chain settles, A's
// unconditional cleanup would delete B's freshly-taken lock and let a third
// command run concurrently with B.
//
// Engine work is additionally serialized per `${roomId}:${userId}` lane via
// `RoomManager.runSerializedEngineWork` (see the `command` mutation below and
// packages/engine/src/helpers/room-engine-queue.ts).
export const activeFlows = new Map<string, string>();

// One prompt-free mutation (workshop equip/unequip/presets, etc.) per user per
// room. Console dispatch checks this before starting an interactive flow so a
// slow workshop HTTP call cannot interleave with a console equip flow for the
// same user. Workshop acquires synchronously before any await and releases in
// `.finally()` with the same ownership-token pattern as `activeFlows`.
export const activePromptFreeMutations = new Map<string, string>();

function tryAcquirePromptFreeMutation(flowKey: string): string | null {
	if (activePromptFreeMutations.has(flowKey)) {
		return null;
	}
	const token = randomUUID();
	activePromptFreeMutations.set(flowKey, token);
	return token;
}

function releasePromptFreeMutation(flowKey: string, token: string): void {
	if (activePromptFreeMutations.get(flowKey) === token) {
		activePromptFreeMutations.delete(flowKey);
	}
}

const sortBySchema = z.enum(['xp', 'wins', 'winRate', 'coins']);

type SilentChannelMessage = {
	announce?: string;
	question?: string;
	choices?: Record<string, unknown> | string[];
};

function createSilentChannel({
	eventBus,
	userId,
	commandId,
}: {
	eventBus: EventBusPublisher;
	userId: string;
	commandId: string;
}) {
	return async ({ announce, question }: SilentChannelMessage): Promise<unknown> => {
		if (question) {
			throw new TRPCError({
				code: 'BAD_REQUEST',
				message: 'Interactive prompts are not supported for this operation.',
			});
		}

		if (announce) {
			eventBus.publish({
				type: 'announce',
				scope: 'private',
				targetUserId: userId,
				text: announce,
				payload: { causedByCommandId: commandId, silent: true },
			});
		}

		return undefined;
	};
}

export function createRouter(roomManager: RoomManager) {
	const runSerializedMutation = async <T>(roomId: string, userId: string, fn: () => Promise<T>): Promise<T> => {
		const flowKey = `${roomId}:${userId}`;
		// Interactive console flows run in a per-user lane (see the `command`
		// mutation) and can wait minutes on prompt answers. Workshop mutations
		// must not interleave with that user's in-flight flow — fail fast with
		// a clear message instead of silently mutating shared state mid-flow.
		if (activeFlows.has(flowKey)) {
			const eventBus = await roomManager.getEventBus(roomId);
			const pendingPrompt = eventBus.getPendingPromptForUser(userId);
			throw new TRPCError({
				code: 'PRECONDITION_FAILED',
				message: pendingPrompt
					? 'A console command is in progress — answer or cancel its prompt first.'
					: 'Still processing your previous command — try again in a moment.',
			});
		}
		const mutationToken = tryAcquirePromptFreeMutation(flowKey);
		if (!mutationToken) {
			throw new TRPCError({
				code: 'PRECONDITION_FAILED',
				message: 'A workshop operation is already in progress — try again in a moment.',
			});
		}
		try {
			return await roomManager.runSerializedEngineWork(roomId, fn);
		} catch (err) {
			if (err instanceof TRPCError) throw err;
			throw new TRPCError({
				code: 'BAD_REQUEST',
				message: err instanceof Error ? err.message : 'Operation failed',
			});
		} finally {
			releasePromptFreeMutation(flowKey, mutationToken);
		}
	};

	const leaderboardRouter = t.router({
		roomPlayers: protectedProcedure
			.input(
				z.object({
					roomId: z.string().uuid(),
					limit: z.number().min(1).max(50).optional(),
					sortBy: sortBySchema.optional(),
				})
			)
			.query(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const limit = input.limit ?? 25;
				const [rows, game] = await Promise.all([
					queryRoomPlayers(db, input.roomId, (input.sortBy ?? 'xp') as LeaderboardSort, limit),
					roomManager.getGame(input.roomId),
				]);
				return rows.map((r, i) => ({
					rank: i + 1,
					// Room rankings use the character's current in-game name. Profile names are
					// only a fallback for players without loaded game state.
					displayName: publicDisplayName(
						String(game.characters?.[r.userId]?.givenName ?? r.displayName),
					),
					xp: r.xp,
					wins: r.wins,
					losses: r.losses,
					draws: r.draws,
					winRate: r.winRate,
					coinsEarned: r.coinsEarned,
				}));
			}),

		roomMonsters: protectedProcedure
			.input(
				z.object({
					roomId: z.string().uuid(),
					limit: z.number().min(1).max(50).optional(),
					sortBy: sortBySchema.optional(),
				})
			)
			.query(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const limit = input.limit ?? 25;
				const [rows, game] = await Promise.all([
					queryRoomMonsters(db, input.roomId, (input.sortBy ?? 'xp') as LeaderboardSort, limit),
					roomManager.getGame(input.roomId),
				]);
				const currentMonsterNames = new Map<string, string>();
				for (const character of Object.values(game.characters ?? {}) as Array<{ monsters?: Array<{ stableId: string; givenName: string }> }>) {
					for (const monster of character.monsters ?? []) currentMonsterNames.set(monster.stableId, monster.givenName);
				}
				const streaks = await computeMonsterWinStreaks(
					db,
					input.roomId,
					rows.map((r) => r.monsterId)
				);
				return rows.map((r, i) => ({
					rank: i + 1,
					monsterId: r.monsterId,
					displayName: currentMonsterNames.get(r.monsterId) ?? r.displayName,
					monsterType: r.monsterType,
					ownerName: r.ownerName,
					xp: r.xp,
					level: r.level,
					wins: r.wins,
					losses: r.losses,
					draws: r.draws,
					winRate: r.winRate,
					winStreak: streaks.get(r.monsterId) ?? 0,
				}));
			}),

		globalPlayers: protectedProcedure
			.input(
				z.object({
					limit: z.number().min(1).max(50).optional(),
					sortBy: sortBySchema.optional(),
				})
			)
			.query(async ({ input }) => {
				const limit = input.limit ?? 25;
				const rows = await queryGlobalPlayers(db, (input.sortBy ?? 'xp') as LeaderboardSort, limit);
				return rows.map((r, i) => ({
					rank: i + 1,
					displayName: r.displayName,
					xp: r.xp,
					wins: r.wins,
					losses: r.losses,
					draws: r.draws,
					winRate: r.winRate,
					coinsEarned: r.coinsEarned,
					roomCount: r.roomCount,
				}));
			}),

		globalMonsters: protectedProcedure
			.input(
				z.object({
					limit: z.number().min(1).max(50).optional(),
					sortBy: sortBySchema.optional(),
				})
			)
			.query(async ({ input }) => {
				const limit = input.limit ?? 25;
				const rows = await queryGlobalMonsters(db, (input.sortBy ?? 'xp') as LeaderboardSort, limit);
				return rows.map((r, i) => ({
					rank: i + 1,
					displayName: r.displayName,
					monsterType: r.monsterType,
					ownerName: r.ownerName,
					xp: r.xp,
					level: r.level,
					wins: r.wins,
					losses: r.losses,
					draws: r.draws,
					winRate: r.winRate,
				}));
			}),
	});

	const roomRouter = t.router({
		create: protectedProcedure
			.input(z.object({ name: z.string().min(1).max(100) }))
			.mutation(async ({ input, ctx }) => {
				return roomManager.createRoom(ctx.userId, input.name);
			}),

		join: protectedProcedure
			.input(z.object({ inviteCode: z.string() }))
			.mutation(async ({ input, ctx }) => {
				return roomManager.joinRoom(ctx.userId, input.inviteCode);
			}),

		leave: protectedProcedure
			.input(z.object({ roomId: z.string().uuid() }))
			.mutation(async ({ input, ctx }) => {
				await roomManager.leaveRoom(ctx.userId, input.roomId);
				return { ok: true };
			}),

		delete: protectedProcedure
			.input(z.object({ roomId: z.string().uuid() }))
			.mutation(async ({ input, ctx }) => {
				await roomManager.deleteRoom(ctx.userId, input.roomId);
				return { ok: true };
			}),

		list: protectedProcedure.query(async ({ ctx }) => {
			return roomManager.listRoomsForUser(ctx.userId);
		}),

		info: protectedProcedure
			.input(z.object({ roomId: z.string().uuid() }))
			.query(async ({ input, ctx }) => {
				const info = await roomManager.getRoomInfo(ctx.userId, input.roomId);
				if (!info) throw new TRPCError({ code: 'NOT_FOUND' });
				return info;
			}),

		members: protectedProcedure
			.input(z.object({ roomId: z.string().uuid() }))
			.query(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				return roomManager.getRoomMembers(input.roomId);
			}),
	});

	const gameRouter = t.router({
		command: protectedProcedure
			.input(
				z.object({
					roomId: z.string().uuid(),
					command: z.string().min(1),
					channelName: z.string().default('default'),
					isDM: z.boolean().default(false),
				})
			)
			.mutation(async ({ input, ctx }) => {
				try {
				log.debug('command received', {
					roomId: input.roomId,
					userId: ctx.userId,
					command: input.command,
					isDM: input.isDM,
				});
				const [role, displayName] = await Promise.all([
					roomManager.getMemberRole(ctx.userId, input.roomId),
					roomManager.getDisplayName(ctx.userId),
				]);
				const isAdmin = role === 'owner';
				const game = await roomManager.getGame(input.roomId);
				const eventBus = await roomManager.getEventBus(input.roomId);

				// Prevent concurrent interactive flows for the same user+room.
				// The engine is not designed for concurrent access — interleaved prompt
				// flows corrupt game state and produce nonsensical UX.
				const flowKey = `${input.roomId}:${ctx.userId}`;
				if (activeFlows.has(flowKey)) {
					const pendingPrompt = eventBus.getPendingPromptForUser(ctx.userId);
					log.debug('command blocked — flow already in progress', {
						roomId: input.roomId,
						userId: ctx.userId,
						command: input.command,
						pendingPromptRequestId: pendingPrompt?.requestId,
					});
					commandsTotal.inc({ room_id: input.roomId, result: 'rejected' });
					return {
						ok: false,
						message: pendingPrompt
							? 'A command is already in progress — answer the current prompt first.'
							: 'Still processing your previous command — try again in a moment.',
						pendingPrompt,
					};
				}
				if (activePromptFreeMutations.has(flowKey)) {
					log.debug('command blocked — workshop mutation in progress', {
						roomId: input.roomId,
						userId: ctx.userId,
						command: input.command,
					});
					commandsTotal.inc({ room_id: input.roomId, result: 'rejected' });
					return {
						ok: false,
						message:
							'A workshop operation is in progress — wait for it to finish before submitting a command.',
					};
				}
				const action = game.handleCommand({ command: input.command });
				const commandId = randomUUID();

				// Persist a user-input echo event so console history can show
				// previously submitted commands after reload.
				//
				// Echoed BEFORE the recognition check, so a rejected command is echoed too.
				// It used to be published only on the success path, which left the console
				// showing a bare "Command not recognized" with no record of what was
				// rejected — indistinguishable from the *previous* (successful) command
				// having failed, and impossible to debug from a screenshot.
				eventBus.publish({
					type: 'system',
					scope: 'private',
					targetUserId: ctx.userId,
					text: input.command,
					payload: {
						consoleInput: true,
						causedByCommandId: commandId,
					},
				});

				if (!action) {
					log.debug('command not recognized', { roomId: input.roomId, command: input.command });
					commandsTotal.inc({ room_id: input.roomId, result: 'rejected' });
					return { ok: false, message: 'Command not recognized' };
				}
				// The commandId doubles as the flow-lock ownership token — see the
				// activeFlows declaration for why cleanup must be ownership-checked.
				activeFlows.set(flowKey, commandId);
				log.debug('command dispatched', { roomId: input.roomId, userId: ctx.userId, isAdmin });

				// Channel callback: all output (announcements and prompts) goes through
				// the event bus so the web client receives it via the ringFeed WebSocket.
				//
				// Questions WITHOUT choices (free-text) are treated the same as questions
				// with choices — sendPrompt is always called when there is a question.
				const channel = async ({
					announce,
					question,
					choices,
				}: {
					announce?: string;
					question?: string;
					choices?: Record<string, unknown> | string[];
				}): Promise<unknown> => {
					if (question) {
						const choiceKeys = choices
							? Array.isArray(choices)
								? choices
								: Object.keys(choices)
							: [];
						const answer = await eventBus.sendPrompt(ctx.userId, question, choiceKeys);
						// Cancelled flows resolve with a sentinel — abort the action
						// chain instead of handing '__cancelled__' to game code as an
						// answer (it would be parsed as a card/monster selection).
						if (answer === PROMPT_CANCELLED) {
							throw new PromptCancelledError();
						}
						return answer;
					}

					if (announce) {
						eventBus.publish({
							type: 'announce',
							scope: 'private',
							targetUserId: ctx.userId,
							text: announce,
							payload: { causedByCommandId: commandId },
						});
					}

					return undefined;
				};

				// Fire-and-forget: do NOT await the action. The interactive flow
				// (character creation, spawning, equipping, etc.) involves multiple
				// sendPrompt calls that can take minutes. Awaiting here would hold the
				// HTTP connection open until the entire flow completes or times out.
				// Instead, we return immediately; all output arrives via ringFeed.
				//
				// Serialize per room AND user. A room-wide lane would let one user's
				// interactive flow (which can wait minutes on prompt answers) starve
				// every other member's commands in the room. Same-user ordering is
				// what actually matters for state consistency here: `activeFlows`
				// already prevents concurrent flows for one user, and workshop
				// mutations fail fast while the user has a flow in progress.
				void roomManager
					.runSerializedEngineWork(`${input.roomId}:${ctx.userId}`, () =>
						action({
							channel,
							channelName: input.channelName,
							isAdmin,
							isDM: input.isDM,
							user: { id: ctx.userId, name: displayName },
						})
					)
					.catch((err: unknown) => {
						// Prompt timeouts and cancellations are expected when users
						// abandon or cancel a flow — not errors.
						const isCancelled =
							err instanceof PromptCancelledError ||
							(err instanceof Error && err.name === 'PromptCancelledError');
						// Expected user-facing refusal. The message was already sent to the web
						// console via channel({ announce }) before the throw. Detected via the
						// isCommandRefusal type guard (sentinel-based, survives package/runtime
						// boundary mismatches). Nothing more to do — don't log as an error.
						const isRefusal = isCommandRefusal(err);
						const msg = err instanceof Error ? err.message : String(err);
						if (!isCancelled && !isRefusal && !msg.includes('Prompt timed out')) {
							roomManager['log']?.(err);
						}
					})
					.then(() => {
						// Contextual suggestions for the console chip strip. Emitted after
						// the flow settles (success or failure) so they reflect the state
						// the user is actually looking at. Never let this throw into the
						// pipeline — suggestions are a nicety, not part of the command.
						try {
							const actions = buildQuickActions(game, ctx.userId);
							if (actions.length > 0) {
								eventBus.publish({
									type: 'quick_actions' as EventType,
									scope: 'private',
									targetUserId: ctx.userId,
									text: '',
									payload: { actions, causedByCommandId: commandId },
								});
							}
						} catch (err: unknown) {
							roomManager['log']?.(err);
						}
					})
					.finally(() => {
						// Only clear the lock this flow still owns. After a cancelFlow,
						// a newer command may hold the key with its own token — deleting
						// unconditionally here would release that newer flow's lock.
						if (activeFlows.get(flowKey) === commandId) {
							activeFlows.delete(flowKey);
						}
					});


				void touchMemberLastSeen(db, input.roomId, ctx.userId).catch(() => {});

				commandsTotal.inc({ room_id: input.roomId, result: 'ok' });
				return { ok: true, commandId };
				} catch (err) {
					commandsTotal.inc({ room_id: input.roomId, result: 'error' });
					throw err;
				}
			}),

		respondToPrompt: protectedProcedure
			.input(
				z.object({
					roomId: z.string().uuid(),
					requestId: z.string(),
					answer: z.string(),
				})
			)
			.mutation(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				log.debug('prompt response received', {
					roomId: input.roomId,
					userId: ctx.userId,
					requestId: input.requestId,
				});
				const eventBus = await roomManager.getEventBus(input.roomId);
				const handled = eventBus.respondToPrompt(input.requestId, input.answer, ctx.userId);
				if (!handled) {
					const pendingPrompt = eventBus.getPendingPromptForUser(ctx.userId);
					throw new TRPCError({
						code: 'PRECONDITION_FAILED',
						message: 'Prompt is no longer active. Please answer the latest prompt.',
						cause: {
							requestId: input.requestId,
							pendingPromptRequestId: pendingPrompt?.requestId ?? null,
						},
					});
				}
				return { ok: true };
			}),

		cancelPrompt: protectedProcedure
			.input(
				z.object({
					roomId: z.string().uuid(),
					requestId: z.string(),
				})
			)
			.mutation(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const eventBus = await roomManager.getEventBus(input.roomId);
				eventBus.cancelPrompt(input.requestId, ctx.userId);
				return { ok: true };
			}),

		cancelFlow: protectedProcedure
			.input(z.object({ roomId: z.string().uuid() }))
			.mutation(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const eventBus = await roomManager.getEventBus(input.roomId);
				// Cancel all pending prompts — this resolves them with '__cancelled__'
				// which allows the in-flight action promise chain to settle normally
				// and release the activeFlows lock in its .finally() handler.
				eventBus.cancelAllUserPrompts(ctx.userId);
				// Belt-and-suspenders: force-clear the lock immediately so the user
				// isn't blocked if the action chain doesn't settle within a tick.
				activeFlows.delete(`${input.roomId}:${ctx.userId}`);
				return { ok: true };
			}),

		ringState: protectedProcedure
			.input(z.object({ roomId: z.string().uuid() }))
			.query(async ({ input, ctx }) => {
				return roomManager.getRingState(ctx.userId, input.roomId);
			}),

		myMonsters: protectedProcedure
			.input(z.object({ roomId: z.string().uuid() }))
			.query(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const game = await roomManager.getGame(input.roomId);
				const character = game.characters?.[ctx.userId];
				const monsters = Array.isArray(character?.monsters) ? character.monsters : [];
				const inRing = new Set(
					game.ring.contestants
						.filter((contestant) => contestant?.userId === ctx.userId && !contestant?.isBoss)
						.map((contestant) => contestant?.monster)
				);

				return monsters
					.map((monster: { givenName?: unknown; dead?: unknown; battles?: { total?: unknown } }) => ({
						name: String(monster?.givenName ?? '').trim(),
						dead: Boolean(monster?.dead),
						inRing: inRing.has(monster),
						battlesTotal:
							typeof monster?.battles?.total === 'number' && Number.isFinite(monster.battles.total)
								? monster.battles.total
								: 0,
					}))
					.filter((monster: { name: string }) => monster.name.length > 0);
			}),

		spawnOptions: protectedProcedure
			.input(z.object({ roomId: z.string().uuid() }))
			.query(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				return {
					types: allMonsters.map((Monster, index) => ({
						index,
						label: String((Monster as unknown as { creatureType?: string }).creatureType ?? Monster.name),
					})),
					genders: ['female', 'male', 'androgynous'] as const,
				};
			}),

		/*
		 * Everything the engine's character creation would otherwise *ask* for. The
		 * workshop runs on a prompt-free channel (docs/engine-concurrency-and-timing.md),
		 * so a first-run player has to answer these in the form, up front, instead.
		 * The class is not offered: `helpers/all.ts` has exactly one entry, and the engine
		 * no longer asks either.
		 */
		characterCreationChoices: protectedProcedure
			.input(z.object({ roomId: z.string().uuid() }))
			.query(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				return {
					genders: Object.keys(PRONOUNS),
					// The console prompt's own avatar generator, so the two pickers cannot drift.
					avatars: randomAvatarChoices(7),
					suggestedName: await roomManager.getDisplayName(ctx.userId),
				};
			}),

		spawnMonster: protectedProcedure
			.input(z.object({
				roomId: z.string().uuid(),
				type: z.number().int().nonnegative(),
				gender: z.enum(['male', 'female', 'androgynous']),
				name: z.string().trim().min(1).max(40),
				color: z.string().trim().min(1).max(100),
				// First run only: training a monster was a brand-new player's first action in
				// the workshop and it dead-ended on "create your character first" with nowhere
				// to do that. Supplying these creates the character as part of the same spawn.
				// Ignored when the player already has a character.
				character: z.object({
					name: z.string().trim().min(1).max(40),
					gender: z.enum(['male', 'female', 'androgynous']),
					avatar: z.string().min(1).max(16),
				}).optional(),
			}))
			.mutation(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				if (!allMonsters[input.type]) {
					throw new TRPCError({ code: 'BAD_REQUEST', message: 'That monster type is not available.' });
				}
				const [game, eventBus] = await Promise.all([roomManager.getGame(input.roomId), roomManager.getEventBus(input.roomId)]);
				const existingCharacter = game.characters?.[ctx.userId];
				if (existingCharacter && typeof existingCharacter.spawnMonster !== 'function') {
					throw new TRPCError({ code: 'NOT_FOUND', message: "You don't have a character in this room yet — fill in the character details to create one." });
				}
				if (!existingCharacter && !input.character) {
					throw new TRPCError({ code: 'NOT_FOUND', message: "You don't have a character in this room yet — fill in the character details to create one." });
				}
				const channel = createSilentChannel({ eventBus, userId: ctx.userId, commandId: randomUUID() });
				const monster = await runSerializedMutation(input.roomId, ctx.userId, async () => {
					let character = existingCharacter;
					if (!character && input.character) {
						// `createCharacter` re-prompts when the chosen name clashes with another
						// character in this game, and this channel throws on any question — so the
						// clash has to be caught here, before the engine can ask about it.
						if (game.findCharacterByName?.(input.character.name)) {
							throw new TRPCError({ code: 'CONFLICT', message: 'That name is already taken in this room.' });
						}
						// Prompt-free because every question `createCharacter` asks has its answer
						// supplied: class (index 0, the only one), gender, name and avatar.
						// Creation and the spawn share this one serialized mutation, so no other
						// request sees a half-finished onboarding. If the spawn itself fails the
						// character does remain — better than losing the identity the player just
						// chose, and the next Train attempt takes the existing-character path.
						character = await game.getCharacter({
							channel,
							id: ctx.userId,
							name: input.character.name,
							type: 0,
							gender: input.character.gender,
							icon: input.character.avatar,
						});
					}
					if (!character || typeof character.spawnMonster !== 'function') {
						throw new TRPCError({ code: 'NOT_FOUND', message: "You don't have a character in this room yet — fill in the character details to create one." });
					}
					const takenNames = Object.keys(game.getAllMonstersLookup?.() ?? {});
					if (takenNames.includes(input.name.toLowerCase())) throw new TRPCError({ code: 'CONFLICT', message: 'That monster name is already taken.' });
					return character.spawnMonster(channel, { type: input.type, gender: input.gender, name: input.name, color: input.color, game });
				}) as { givenName?: unknown; creatureType?: unknown };
				return { ok: true as const, monsterName: String(monster?.givenName ?? input.name), monsterType: String(monster?.creatureType ?? '') };
			}),

		myInventory: protectedProcedure
			.input(z.object({ roomId: z.string().uuid() }))
			.query(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const game = await roomManager.getGame(input.roomId);
				const character = game.characters?.[ctx.userId];
				if (!character || typeof character !== 'object') {
					return {
						hasCharacter: false,
						monsters: [],
						unequippedDeck: [],
						cardCompatibility: {},
						items: { character: [], monsters: [] },
					} satisfies InventorySummary;
				}

				const inRing = new Set(
					game.ring.contestants
						.filter((contestant) => contestant?.userId === ctx.userId && !contestant?.isBoss)
						.map((contestant) => contestant?.monster)
				);

				return summarizeInventory({
					character: character as Record<string, unknown>,
					inRing,
				});
			}),

		shop: protectedProcedure
			.input(z.object({ roomId: z.string().uuid() }))
			.query(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const game = await roomManager.getGame(input.roomId);
				const character = game.characters?.[ctx.userId];
				if (!character) {
					throw new TRPCError({ code: 'NOT_FOUND', message: 'Character not found' });
				}
				// `Game.shop` may rotate and persist expired stock even though this is an HTTP
				// query. Serialize that write with purchases so two first reads after the same
				// boundary cannot generate competing merchants and overwrite each other.
				return roomManager.runSerializedEngineWork(input.roomId, async () =>
					summarizeShop(game, character),
				);
			}),

		buyShopItem: protectedProcedure
			.input(z.object({
				roomId: z.string().uuid(),
				section: z.enum(['items', 'backRoom', 'cards']),
				stockIndex: z.number().int().min(0),
				expectedItemType: z.string().min(1),
				expectedClosingTime: z.string().datetime(),
			}))
			.mutation(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const game = await roomManager.getGame(input.roomId);
				const character = game.characters?.[ctx.userId];
				// Cards land on the deck via `addCard`, items via `addItem` — see
				// `purchaseShopItem`. Require whichever one this purchase will actually call
				// so a malformed/legacy character object fails fast with NOT_FOUND rather than
				// throwing deep inside the serialized mutation.
				const requiredMethod = input.section === 'cards' ? 'addCard' : 'addItem';
				if (!character || typeof character[requiredMethod] !== 'function') {
					throw new TRPCError({ code: 'NOT_FOUND', message: 'Character not found' });
				}

				const result = await runSerializedMutation(input.roomId, ctx.userId, async () =>
					purchaseShopItem({
						character,
						host: game,
						section: input.section,
						stockIndex: input.stockIndex,
						expectedItemType: input.expectedItemType,
						expectedClosingTime: input.expectedClosingTime,
					}),
				);

				return {
					ok: true as const,
					itemName: getDisplayName(result.item),
					price: result.price,
					remainingCoins: result.remainingCoins,
				};
			}),

		reviveMonster: protectedProcedure
			.input(z.object({ roomId: z.string().uuid(), monsterName: z.string().min(1) }))
			.mutation(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const [game, eventBus] = await Promise.all([
					roomManager.getGame(input.roomId),
					roomManager.getEventBus(input.roomId),
				]);
				const character = game.characters?.[ctx.userId];
				if (!character || typeof character.reviveMonster !== 'function') {
					throw new TRPCError({ code: 'NOT_FOUND', message: 'Character not found' });
				}

				const commandId = randomUUID();
				const channel = createSilentChannel({ eventBus, userId: ctx.userId, commandId });
				const monster = await runSerializedMutation(input.roomId, ctx.userId, () =>
					character.reviveMonster({ monsterName: input.monsterName, channel }),
				) as { givenName?: unknown };
				return { ok: true as const, monsterName: String(monster?.givenName ?? input.monsterName) };
			}),

		sendMonsterToRing: protectedProcedure
			.input(z.object({ roomId: z.string().uuid(), monsterName: z.string().min(1) }))
			.mutation(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const [game, eventBus] = await Promise.all([
					roomManager.getGame(input.roomId),
					roomManager.getEventBus(input.roomId),
				]);
				const character = game.characters?.[ctx.userId];
				if (!character || typeof character.sendMonsterToTheRing !== 'function') {
					throw new TRPCError({ code: 'NOT_FOUND', message: 'Character not found' });
				}

				const commandId = randomUUID();
				const channel = createSilentChannel({ eventBus, userId: ctx.userId, commandId });
				await runSerializedMutation(input.roomId, ctx.userId, () =>
					character.sendMonsterToTheRing({
						monsterName: input.monsterName,
						ring: game.ring,
						channel,
						channelName: 'web',
						userId: ctx.userId,
					}),
				);
				return { ok: true as const, monsterName: input.monsterName };
			}),

		/**
		 * The mid-fight lever, finally reachable from the browser. See
		 * docs/roadmap/19-player-agency-and-items.md §8, where the absence of this procedure
		 * was the single blocker on the whole items story — the web client could list items
		 * but not use one.
		 *
		 * `confirmed: true` is what makes it possible at all: `useItems` otherwise asks
		 * "Are you sure?" unconditionally, and a prompt cannot be answered inside a mutation.
		 * The web client's own confirmation stands in for it. Which items are usable, and the
		 * narrowing to `monster.items` once a monster is in an encounter, stay in the engine
		 * helper rather than being re-derived here, so the rule has one home.
		 *
		 * `monsterName` absent means "use on the character" — the engine skips the monster
		 * lookup entirely in that case, so the prompt-free path holds for both.
		 */
		useItem: protectedProcedure
			.input(
				z.object({
					roomId: z.string().uuid(),
					itemName: z.string().min(1),
					monsterName: z.string().min(1).optional(),
					// Disambiguates a type held both in the character's pocket and on the
					// target monster — without it the engine's name match takes the monster's
					// copy, spending an item the player deliberately stocked.
					itemSource: z.enum(['character', 'monster']).optional(),
				}),
			)
			.mutation(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const [game, eventBus] = await Promise.all([
					roomManager.getGame(input.roomId),
					roomManager.getEventBus(input.roomId),
				]);
				const character = game.characters?.[ctx.userId];
				if (!character || typeof character.useItems !== 'function') {
					throw new TRPCError({ code: 'NOT_FOUND', message: 'Character not found' });
				}

				const commandId = randomUUID();
				const channel = createSilentChannel({ eventBus, userId: ctx.userId, commandId });
				const results = (await runSerializedMutation(input.roomId, ctx.userId, () =>
					character.useItems({
						channel,
						channelName: 'web',
						confirmed: true,
						itemSelection: [input.itemName],
						itemSource: input.itemSource,
						monsterName: input.monsterName,
					}),
				)) as unknown;

				/*
				 * An item whose conditions are not met returns `false` from its `action` and is
				 * deliberately not consumed — Spin Up on a living monster, a healing potion on a
				 * dead one. `canUseItem` is only a compatibility check (it is `canHoldItem`), so
				 * neither the client's tier nor this procedure can know in advance. Reporting
				 * `ok` regardless told the player the item was used when nothing happened.
				 */
				const applied = Array.isArray(results)
					? results.some((result) => result !== false)
					: results !== false;

				return {
					ok: true as const,
					applied,
					itemName: input.itemName,
					monsterName: input.monsterName,
				};
			}),

		unequipCard: protectedProcedure
			.input(
				z.object({
					roomId: z.string().uuid(),
					monsterName: z.string().min(1),
					cardName: z.string().min(1),
					count: z.number().int().min(1).max(9).optional(),
				}),
			)
			.mutation(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const [game, eventBus] = await Promise.all([
					roomManager.getGame(input.roomId),
					roomManager.getEventBus(input.roomId),
				]);
				const character = game.characters?.[ctx.userId];
				if (!character || typeof character.unequipCard !== 'function') {
					throw new TRPCError({ code: 'NOT_FOUND', message: 'Character not found' });
				}

				const commandId = randomUUID();
				const channel = createSilentChannel({ eventBus, userId: ctx.userId, commandId });
				const result = await runSerializedMutation(input.roomId, ctx.userId, () =>
					character.unequipCard({
						channel,
						cardName: input.cardName,
						monsterName: input.monsterName,
						count: input.count,
					}),
				) as { removedCount: number; monsterName: string };
				eventBus.publish({
					type: 'card.equipped' as EventType,
					scope: 'private',
					targetUserId: ctx.userId,
					text: '',
					payload: {
						operation: 'unequipCard',
						removedCount: result.removedCount,
						monsterName: result.monsterName,
					},
				});
				publishPrivateAnnouncement({
					eventBus,
					userId: ctx.userId,
					text: `Unequipped ${result.removedCount} ${input.cardName} from ${result.monsterName}.`,
					operation: 'unequipCard',
				});
				eventBus.publish({
					type: 'card.equipped' as EventType,
					scope: 'private',
					targetUserId: ctx.userId,
					text: '',
					payload: {
						monsterName: result.monsterName,
						cards: getMonsterCardsByName({
							character: character as Record<string, unknown>,
							monsterName: result.monsterName,
						}),
					},
				});
				return result;
			}),

		unequipAll: protectedProcedure
			.input(
				z.object({
					roomId: z.string().uuid(),
					monsterName: z.string().min(1),
				}),
			)
			.mutation(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const [game, eventBus] = await Promise.all([
					roomManager.getGame(input.roomId),
					roomManager.getEventBus(input.roomId),
				]);
				const character = game.characters?.[ctx.userId];
				if (!character || typeof character.unequipAll !== 'function') {
					throw new TRPCError({ code: 'NOT_FOUND', message: 'Character not found' });
				}

				const commandId = randomUUID();
				const channel = createSilentChannel({ eventBus, userId: ctx.userId, commandId });
				const result = await runSerializedMutation(input.roomId, ctx.userId, () =>
					character.unequipAll({
						channel,
						monsterName: input.monsterName,
					}),
				) as { removedCount: number; monsterName: string };
				eventBus.publish({
					type: 'card.equipped' as EventType,
					scope: 'private',
					targetUserId: ctx.userId,
					text: '',
					payload: {
						operation: 'unequipAll',
						removedCount: result.removedCount,
						monsterName: result.monsterName,
					},
				});
				publishPrivateAnnouncement({
					eventBus,
					userId: ctx.userId,
					text: `Cleared ${result.monsterName} (${result.removedCount} cards returned).`,
					operation: 'unequipAll',
				});
				eventBus.publish({
					type: 'card.equipped' as EventType,
					scope: 'private',
					targetUserId: ctx.userId,
					text: '',
					payload: {
						monsterName: result.monsterName,
						cards: getMonsterCardsByName({
							character: character as Record<string, unknown>,
							monsterName: result.monsterName,
						}),
					},
				});
				return result;
			}),

		equipCards: protectedProcedure
			.input(
				z.object({
					roomId: z.string().uuid(),
					monsterName: z.string().min(1),
					cardNames: z.array(z.string().min(1)).min(1),
					replaceAll: z.boolean().optional(),
				}),
			)
			.mutation(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const [game, eventBus] = await Promise.all([
					roomManager.getGame(input.roomId),
					roomManager.getEventBus(input.roomId),
				]);
				const character = game.characters?.[ctx.userId];
				if (!character || typeof character.equipCards !== 'function') {
					throw new TRPCError({ code: 'NOT_FOUND', message: 'Character not found' });
				}

				const commandId = randomUUID();
				const channel = createSilentChannel({ eventBus, userId: ctx.userId, commandId });
				const result = await runSerializedMutation(input.roomId, ctx.userId, () =>
					character.equipCards({
						channel,
						monsterName: input.monsterName,
						cardNames: input.cardNames,
						replaceAll: input.replaceAll ?? false,
					}),
				) as { equipped: number; requested: number; skippedCards: string[]; monsterName: string };
				eventBus.publish({
					type: 'card.equipped' as EventType,
					scope: 'private',
					targetUserId: ctx.userId,
					text: '',
					payload: {
						operation: 'equipCards',
						monsterName: result.monsterName,
						cardNames: input.cardNames,
						equippedCount: result.equipped,
						requestedCount: result.requested,
						skippedCards: result.skippedCards,
					},
				});

				const skippedText = result.skippedCards.length > 0
					? ` Skipped: ${result.skippedCards.join(', ')}.`
					: '';
				publishPrivateAnnouncement({
					eventBus,
					userId: ctx.userId,
					text: `Equipped ${result.monsterName}: ${result.equipped}/${result.requested}.${skippedText}`,
					operation: 'equipCards',
				});
				eventBus.publish({
					type: 'card.equipped' as EventType,
					scope: 'private',
					targetUserId: ctx.userId,
					text: '',
					payload: {
						monsterName: result.monsterName,
						cards: getMonsterCardsByName({
							character: character as Record<string, unknown>,
							monsterName: result.monsterName,
						}),
					},
				});
				return {
					equippedCount: result.equipped,
					requestedCount: result.requested,
					skippedCards: result.skippedCards,
				};
			}),

		moveCard: protectedProcedure
			.input(
				z.object({
					roomId: z.string().uuid(),
					cardName: z.string().min(1),
					fromMonsterName: z.string().min(1),
					toMonsterName: z.string().min(1),
					count: z.number().int().min(1).max(9).optional(),
				}),
			)
			.mutation(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const [game, eventBus] = await Promise.all([
					roomManager.getGame(input.roomId),
					roomManager.getEventBus(input.roomId),
				]);
				const character = game.characters?.[ctx.userId];
				if (!character || typeof character.moveCard !== 'function') {
					throw new TRPCError({ code: 'NOT_FOUND', message: 'Character not found' });
				}

				const commandId = randomUUID();
				const channel = createSilentChannel({ eventBus, userId: ctx.userId, commandId });
				const result = await runSerializedMutation(input.roomId, ctx.userId, () =>
					character.moveCard({
						channel,
						cardName: input.cardName,
						fromMonsterName: input.fromMonsterName,
						toMonsterName: input.toMonsterName,
						count: input.count,
					}),
				) as { movedCount: number; fromMonsterName: string; toMonsterName: string };
				eventBus.publish({
					type: 'card.equipped' as EventType,
					scope: 'private',
					targetUserId: ctx.userId,
					text: '',
					payload: {
						operation: 'moveCard',
						movedCount: result.movedCount,
						fromMonsterName: result.fromMonsterName,
						toMonsterName: result.toMonsterName,
					},
				});
				publishPrivateAnnouncement({
					eventBus,
					userId: ctx.userId,
					text: `Moved ${result.movedCount} ${input.cardName} from ${result.fromMonsterName} to ${result.toMonsterName}.`,
					operation: 'moveCard',
				});
				eventBus.publish({
					type: 'card.equipped' as EventType,
					scope: 'private',
					targetUserId: ctx.userId,
					text: '',
					payload: {
						monsterName: result.fromMonsterName,
						cards: getMonsterCardsByName({
							character: character as Record<string, unknown>,
							monsterName: result.fromMonsterName,
						}),
					},
				});
				eventBus.publish({
					type: 'card.equipped' as EventType,
					scope: 'private',
					targetUserId: ctx.userId,
					text: '',
					payload: {
						monsterName: result.toMonsterName,
						cards: getMonsterCardsByName({
							character: character as Record<string, unknown>,
							monsterName: result.toMonsterName,
						}),
					},
				});
				return result;
			}),

		unequipMany: protectedProcedure
			.input(
				z.object({
					roomId: z.string().uuid(),
					monsterName: z.string().min(1),
					cards: z
						.array(
							z.object({
								cardName: z.string().min(1),
								count: z.number().int().min(1).max(9).optional(),
							}),
						)
						.min(1),
				}),
			)
			.mutation(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const [game, eventBus] = await Promise.all([
					roomManager.getGame(input.roomId),
					roomManager.getEventBus(input.roomId),
				]);
				const character = game.characters?.[ctx.userId];
				if (!character || typeof character.unequipCard !== 'function') {
					throw new TRPCError({ code: 'NOT_FOUND', message: 'Character not found' });
				}

				const commandId = randomUUID();
				const channel = createSilentChannel({ eventBus, userId: ctx.userId, commandId });
				// A batch is not atomic — the engine has no transaction to roll back to,
				// so a card failing partway through leaves the earlier ones already
				// unequipped. Collect per-card failures and keep going rather than
				// throwing, so the events below still fire and the client still
				// invalidates its cache; otherwise the user sees an error next to
				// inventory that silently changed underneath them.
				const { removedCount, monsterName, failures } = await runSerializedMutation(input.roomId, ctx.userId, async () => {
					let removedCount = 0;
					let monsterName = input.monsterName;
					const failures: Array<{ cardName: string; reason: string }> = [];
					for (const { cardName, count } of input.cards) {
						try {
							const result = (await character.unequipCard({
								channel,
								cardName,
								monsterName: input.monsterName,
								count,
							})) as { removedCount: number; monsterName: string };
							removedCount += result.removedCount;
							monsterName = result.monsterName;
						} catch (err) {
							failures.push({
								cardName,
								reason: err instanceof Error ? err.message : 'Failed to unequip',
							});
						}
					}
					return { removedCount, monsterName, failures };
				});
				// Nothing changed and something went wrong — surface it as a real error
				// instead of reporting a successful no-op.
				if (removedCount === 0 && failures.length > 0) {
					throw new TRPCError({ code: 'BAD_REQUEST', message: failures[0]!.reason });
				}
				eventBus.publish({
					type: 'card.equipped' as EventType,
					scope: 'private',
					targetUserId: ctx.userId,
					text: '',
					payload: {
						operation: 'unequipMany',
						removedCount,
						monsterName,
					},
				});
				publishPrivateAnnouncement({
					eventBus,
					userId: ctx.userId,
					text: failures.length > 0
						? `Unequipped ${removedCount} cards from ${monsterName}. Could not unequip: ${failures.map((f) => f.cardName).join(', ')}.`
						: `Unequipped ${removedCount} cards from ${monsterName}.`,
					operation: 'unequipMany',
				});
				eventBus.publish({
					type: 'card.equipped' as EventType,
					scope: 'private',
					targetUserId: ctx.userId,
					text: '',
					payload: {
						monsterName,
						cards: getMonsterCardsByName({
							character: character as Record<string, unknown>,
							monsterName,
						}),
					},
				});
				return { removedCount, monsterName, failures };
			}),

		moveMany: protectedProcedure
			.input(
				z.object({
					roomId: z.string().uuid(),
					fromMonsterName: z.string().min(1),
					toMonsterName: z.string().min(1),
					cards: z
						.array(
							z.object({
								cardName: z.string().min(1),
								count: z.number().int().min(1).max(9).optional(),
							}),
						)
						.min(1),
				}),
			)
			.mutation(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const [game, eventBus] = await Promise.all([
					roomManager.getGame(input.roomId),
					roomManager.getEventBus(input.roomId),
				]);
				const character = game.characters?.[ctx.userId];
				if (!character || typeof character.moveCard !== 'function') {
					throw new TRPCError({ code: 'NOT_FOUND', message: 'Character not found' });
				}

				const commandId = randomUUID();
				const channel = createSilentChannel({ eventBus, userId: ctx.userId, commandId });
				// Not atomic — see the matching comment in unequipMany.
				const { movedCount, fromMonsterName, toMonsterName, failures } = await runSerializedMutation(
					input.roomId,
					ctx.userId,
					async () => {
						let movedCount = 0;
						let fromMonsterName = input.fromMonsterName;
						let toMonsterName = input.toMonsterName;
						const failures: Array<{ cardName: string; reason: string }> = [];
						for (const { cardName, count } of input.cards) {
							try {
								const result = (await character.moveCard({
									channel,
									cardName,
									fromMonsterName: input.fromMonsterName,
									toMonsterName: input.toMonsterName,
									count,
								})) as { movedCount: number; fromMonsterName: string; toMonsterName: string };
								movedCount += result.movedCount;
								fromMonsterName = result.fromMonsterName;
								toMonsterName = result.toMonsterName;
							} catch (err) {
								failures.push({
									cardName,
									reason: err instanceof Error ? err.message : 'Failed to move',
								});
							}
						}
						return { movedCount, fromMonsterName, toMonsterName, failures };
					},
				);
				if (movedCount === 0 && failures.length > 0) {
					throw new TRPCError({ code: 'BAD_REQUEST', message: failures[0]!.reason });
				}
				eventBus.publish({
					type: 'card.equipped' as EventType,
					scope: 'private',
					targetUserId: ctx.userId,
					text: '',
					payload: {
						operation: 'moveMany',
						movedCount,
						fromMonsterName,
						toMonsterName,
					},
				});
				publishPrivateAnnouncement({
					eventBus,
					userId: ctx.userId,
					text: failures.length > 0
						? `Moved ${movedCount} cards from ${fromMonsterName} to ${toMonsterName}. Could not move: ${failures.map((f) => f.cardName).join(', ')}.`
						: `Moved ${movedCount} cards from ${fromMonsterName} to ${toMonsterName}.`,
					operation: 'moveMany',
				});
				eventBus.publish({
					type: 'card.equipped' as EventType,
					scope: 'private',
					targetUserId: ctx.userId,
					text: '',
					payload: {
						monsterName: fromMonsterName,
						cards: getMonsterCardsByName({
							character: character as Record<string, unknown>,
							monsterName: fromMonsterName,
						}),
					},
				});
				eventBus.publish({
					type: 'card.equipped' as EventType,
					scope: 'private',
					targetUserId: ctx.userId,
					text: '',
					payload: {
						monsterName: toMonsterName,
						cards: getMonsterCardsByName({
							character: character as Record<string, unknown>,
							monsterName: toMonsterName,
						}),
					},
				});
				return { movedCount, fromMonsterName, toMonsterName, failures };
			}),

		reorderCards: protectedProcedure
			.input(
				z.object({
					roomId: z.string().uuid(),
					monsterName: z.string().min(1),
					fromIndex: z.number().int().min(0),
					toIndex: z.number().int().min(0),
				}),
			)
			.mutation(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const [game, eventBus] = await Promise.all([
					roomManager.getGame(input.roomId),
					roomManager.getEventBus(input.roomId),
				]);
				const character = game.characters?.[ctx.userId];
				if (!character || typeof character.reorderCards !== 'function') {
					throw new TRPCError({ code: 'NOT_FOUND', message: 'Character not found' });
				}

				const commandId = randomUUID();
				const channel = createSilentChannel({ eventBus, userId: ctx.userId, commandId });
				const rawResult = await runSerializedMutation(input.roomId, ctx.userId, () =>
					character.reorderCards({
						channel,
						monsterName: input.monsterName,
						fromIndex: input.fromIndex,
						toIndex: input.toIndex,
					}),
				);
				const result = reorderCardsResultSchema.parse(rawResult);
				publishPrivateAnnouncement({
					eventBus,
					userId: ctx.userId,
					text: `Reordered ${result.monsterName}'s deck (${result.fromIndex + 1} → ${result.toIndex + 1}).`,
					operation: 'reorderCards',
				});
				eventBus.publish({
					type: 'card.equipped' as EventType,
					scope: 'private',
					targetUserId: ctx.userId,
					text: '',
					payload: {
						operation: 'reorderCards',
						monsterName: result.monsterName,
						fromIndex: result.fromIndex,
						toIndex: result.toIndex,
						cards: result.cards,
					},
				});
				return result;
			}),

		savePreset: protectedProcedure
			.input(
				z.object({
					roomId: z.string().uuid(),
					monsterName: z.string().min(1),
					presetName: z.string().min(1).max(32),
				}),
			)
			.mutation(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const [game, eventBus] = await Promise.all([
					roomManager.getGame(input.roomId),
					roomManager.getEventBus(input.roomId),
				]);
				const character = game.characters?.[ctx.userId];
				if (!character || typeof character.savePreset !== 'function') {
					throw new TRPCError({ code: 'NOT_FOUND', message: 'Character not found' });
				}
				const commandId = randomUUID();
				const channel = createSilentChannel({ eventBus, userId: ctx.userId, commandId });
				const result = await runSerializedMutation(input.roomId, ctx.userId, () =>
					character.savePreset({
						channel,
						monsterName: input.monsterName,
						presetName: input.presetName,
					}),
				);
				return result;
			}),

		loadPreset: protectedProcedure
			.input(
				z.object({
					roomId: z.string().uuid(),
					monsterName: z.string().min(1),
					presetName: z.string().min(1).max(32),
				}),
			)
			.mutation(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const [game, eventBus] = await Promise.all([
					roomManager.getGame(input.roomId),
					roomManager.getEventBus(input.roomId),
				]);
				const character = game.characters?.[ctx.userId];
				if (!character || typeof character.loadPreset !== 'function') {
					throw new TRPCError({ code: 'NOT_FOUND', message: 'Character not found' });
				}
				const commandId = randomUUID();
				const channel = createSilentChannel({ eventBus, userId: ctx.userId, commandId });
				const result = await runSerializedMutation(input.roomId, ctx.userId, () =>
					character.loadPreset({
						channel,
						monsterName: input.monsterName,
						presetName: input.presetName,
					}),
				) as { equipped: number; requested: number; skippedCards: string[] };
				eventBus.publish({
					type: 'card.presetLoaded' as EventType,
					scope: 'private',
					targetUserId: ctx.userId,
					text: '',
					payload: result,
				});
				eventBus.publish({
					type: 'card.equipped' as EventType,
					scope: 'private',
					targetUserId: ctx.userId,
					text: '',
					payload: {
						monsterName: input.monsterName,
						cards: getMonsterCardsByName({
							character: character as Record<string, unknown>,
							monsterName: input.monsterName,
						}),
					},
				});
				return {
					equippedCount: result.equipped,
					requestedCount: result.requested,
					skippedCards: result.skippedCards,
				};
			}),

		deletePreset: protectedProcedure
			.input(
				z.object({
					roomId: z.string().uuid(),
					monsterName: z.string().min(1),
					presetName: z.string().min(1).max(32),
				}),
			)
			.mutation(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const [game, eventBus] = await Promise.all([
					roomManager.getGame(input.roomId),
					roomManager.getEventBus(input.roomId),
				]);
				const character = game.characters?.[ctx.userId];
				if (!character || typeof character.deletePreset !== 'function') {
					throw new TRPCError({ code: 'NOT_FOUND', message: 'Character not found' });
				}
				const commandId = randomUUID();
				const channel = createSilentChannel({ eventBus, userId: ctx.userId, commandId });
				const result = await runSerializedMutation(input.roomId, ctx.userId, () =>
					character.deletePreset({
						channel,
						monsterName: input.monsterName,
						presetName: input.presetName,
					}),
				);
				return result;
			}),

		ringHistory: protectedProcedure
			.input(z.object({ roomId: z.string().uuid() }))
			.query(async ({ input, ctx }) => {
				return roomManager.getRingHistory(ctx.userId, input.roomId);
			}),

		consoleHistory: protectedProcedure
			.input(z.object({ roomId: z.string().uuid() }))
			.query(async ({ input, ctx }) => {
				return roomManager.getConsoleHistory(ctx.userId, input.roomId);
			}),

		pendingPrompt: protectedProcedure
			.input(z.object({ roomId: z.string().uuid() }))
			.query(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const eventBus = await roomManager.getEventBus(input.roomId);
				return eventBus.getPendingPromptForUser(ctx.userId);
			}),

		flowStatus: protectedProcedure
			.input(z.object({ roomId: z.string().uuid() }))
			.query(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const flowKey = `${input.roomId}:${ctx.userId}`;
				const eventBus = await roomManager.getEventBus(input.roomId);
				return {
					consoleActive: activeFlows.has(flowKey),
					workshopActive: activePromptFreeMutations.has(flowKey),
					pendingPrompt: eventBus.getPendingPromptForUser(ctx.userId),
				};
			}),

		ringFeed: protectedProcedure
			.input(
				z.object({
					roomId: z.string().uuid(),
					lastEventId: z.string().optional(),
					/*
					 * Ignored here on purpose. The client bumps it when its heartbeat watchdog
					 * gives up, so the resume is a *different* subscription input even when the
					 * cursor has not moved — otherwise the retry is deduplicated and the client
					 * waits forever for a handshake that is never requested. See
					 * 10b-bugs-fixed.md #127.
					 */
					resumeAttempt: z.number().int().nonnegative().optional(),
				})
			)
			.subscription(async function* ({ input, ctx, signal }) {
			await roomManager.assertMember(ctx.userId, input.roomId);
			log.debug('ringFeed subscription opened', {
				roomId: input.roomId,
				userId: ctx.userId,
				lastEventId: input.lastEventId,
			});
			void touchMemberLastSeen(db, input.roomId, ctx.userId).catch(() => {});
			const eventBus = await roomManager.getEventBus(input.roomId);
			const game = await roomManager.getGame(input.roomId);
			const ring = game.ring;

			// Emit handshake event first so the client can verify protocol compatibility.
			// Include current ring timer state so clients have instant values on connect
			// without needing a separate HTTP poll.
			// Use a unique id per subscription invocation so no dedup layer (tRPC
			// client, seenRef, etc.) can swallow the handshake on reconnect.
			// Synthetic (non-persisted) frames still use the `${epochMs}-${suffix}` id
			// shape that real events use. Cursor resolution parses that leading
			// timestamp, so a client that echoes one of these ids back as its
			// `lastEventId` still resolves by time instead of becoming unmatchable.
			const handshakeId = `${Date.now()}-handshake`;
			const handshakeEvent: GameEvent = {
				id: handshakeId,
				roomId: input.roomId,
				timestamp: Date.now(),
				type: 'handshake' as EventType,
				scope: 'private' as EventScope,
				targetUserId: ctx.userId,
				text: '',
				payload: {
					protocolVersion: PROTOCOL_VERSION,
					buildVersion: BUILD_VERSION,
					serverTime: new Date().toISOString(),
					yourUserId: ctx.userId,
					ringState: {
						nextFightAt: ring.nextFightAt,
						nextBossSpawnAt: ring.nextBossSpawnAt,
						monsterCount: ring.contestants.length,
						inEncounter: Boolean(ring.inEncounter),
						// Same shape as the `ring.state` broadcast, so the roster renders
						// immediately on connect instead of staying blank until the next
						// card resolves. Guarded because the handshake bootstraps the whole
						// ringFeed subscription — a throw here would take down the feed, and
						// an empty roster (which the next ring.state repairs) is a far better
						// failure mode than no connection at all.
						contestants:
							typeof ring.contestantSnapshots === 'function' ? ring.contestantSnapshots() : [],
					},
				},
			};
			yield tracked(handshakeId, handshakeEvent);

				// Attach the live subscriber BEFORE computing the replay. Events
				// published while the replay is being assembled (the DB fallback is
				// async) buffer into `queue`; anything the replay also covers is
				// dropped from the buffer via `replayedIds` when the live loop drains.
				// Subscribing after the replay snapshot left a window where those
				// in-between events were simply lost.
				const queue: GameEvent[] = [];
				let resolve: (() => void) | null = null;

				const unsubscribe = eventBus.subscribe(
					`trpc:${ctx.userId}:${Date.now()}`,
					{
						userId: ctx.userId,
						deliver(event: GameEvent) {
							queue.push(event);
							resolve?.();
							resolve = null;
						},
					}
				);

				// Ids yielded during replay — bounded by the replay caps below, so this
				// set stays small for the life of the subscription.
				const replayedIds = new Set<string>();

				// The try/finally must open before the replay: the subscriber is now
				// attached, so a throw during the (async) replay has to reach the
				// finally's unsubscribe() or the subscriber would leak.
				wsConnectionsActive.inc({ room_id: input.roomId });
				try {

				const emitGapEvent = function* (reason: string) {
					ringFeedReplayGapTotal.inc({ room_id: input.roomId });
					const gapId = `${Date.now()}-gap-${randomUUID().slice(0, 8)}`;
					const gapEvent: GameEvent = {
						id: gapId,
						roomId: input.roomId,
						timestamp: Date.now(),
						type: 'system.gap' as EventType,
						scope: 'private' as EventScope,
						targetUserId: ctx.userId,
						text: '── Some events were missed while you were away. ──',
						payload: { reason },
					};
					yield tracked(gapId, gapEvent);
				};

				// Deliver any missed events since the last received event ID.
				if (input.lastEventId) {
					const { events: buffered, truncated, upToDate, status } = eventBus.getEventsSince(
						input.lastEventId
					);
					let missed: GameEvent[] = buffered;
					let replayLimitReached = false;
					if (truncated && !upToDate) {
						const replay = await roomManager.getEventsSinceForRingFeed(
							ctx.userId,
							input.roomId,
							input.lastEventId
						);
						missed = replay.events;
						replayLimitReached = replay.limitReached;
						log.debug('ringFeed replaying from durable storage', {
							roomId: input.roomId,
							userId: ctx.userId,
							status,
							replayed: missed.length,
							limitReached: replayLimitReached,
						});
						if (missed.length > 0) {
							ringFeedReplayFromDbTotal.inc({ room_id: input.roomId });
						} else if (status === 'evicted') {
							// Only warn when events demonstrably passed through the buffer
							// while the room stayed loaded. A cold buffer with no stored
							// events means the room was simply idle (the usual case after a
							// deploy) — warning there would cry wolf on every restart.
							yield* emitGapEvent('buffer_or_retention');
						}
					}
					for (const event of missed) {
						if (
							event.scope === 'public' ||
							event.targetUserId === ctx.userId
						) {
							replayedIds.add(event.id);
							yield tracked(event.id, event);
						}
					}
					if (replayLimitReached) {
						// The replay hit its hard cap, so events between the last replayed
						// row and "now" were silently skipped — say so rather than
						// presenting a truncated stream as complete.
						yield* emitGapEvent('replay_limit');
					}
				} else {
					const recent = eventBus.getRecentEvents(100);
					for (const event of recent) {
						if (
							event.scope === 'public' ||
							event.targetUserId === ctx.userId
						) {
							replayedIds.add(event.id);
							yield tracked(event.id, event);
						}
					}
				}

					// Stream live events until the client disconnects.
					while (!signal?.aborted) {
						while (queue.length > 0) {
							const event = queue.shift()!;
							// Events published while the replay was being assembled were
							// captured by both the subscriber and (possibly) the replay
							// itself — skip the buffered copy of anything already yielded.
							if (replayedIds.has(event.id)) continue;
							log.trace('ringFeed delivering event', {
								roomId: input.roomId,
								userId: ctx.userId,
								eventType: event.type,
								eventId: event.id,
							});
							yield tracked(event.id, event);
						}

						// Wait for an event or 20 s, whichever comes first.
						// The 20-second timeout sends a keep-alive heartbeat frame that
						// prevents load-balancer idle timeouts (typically 30–60 s).
						let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
						await new Promise<void>((res) => {
							let settled = false;
							let onAbort: (() => void) | null = null;

							const finish = () => {
								if (settled) return;
								settled = true;
								resolve = null;
								if (heartbeatTimer !== null) {
									clearTimeout(heartbeatTimer);
									heartbeatTimer = null;
								}
								if (onAbort) signal?.removeEventListener('abort', onAbort);
								res();
							};

							onAbort = () => finish();
							resolve = finish;
							heartbeatTimer = setTimeout(finish, 20_000);
							signal?.addEventListener('abort', onAbort, { once: true });
						});

						// If the queue is still empty after the wait it was a 20-s timeout —
						// yield a private heartbeat frame so the TCP/WS connection stays alive.
						if (queue.length === 0 && !signal?.aborted) {
							const hbId = `${Date.now()}-heartbeat`;
							yield tracked(hbId, {
								id: hbId,
								roomId: input.roomId,
								timestamp: Date.now(),
								type: 'heartbeat' as EventType,
								scope: 'private' as EventScope,
								targetUserId: ctx.userId,
								text: '',
								payload: {},
							});
						}
					}
				} finally {
					unsubscribe();
					wsConnectionsActive.dec({ room_id: input.roomId });
					log.debug('ringFeed subscription closed', {
						roomId: input.roomId,
						userId: ctx.userId,
					});
				}
			}),

		recentFights: protectedProcedure
			.input(
				z.object({
					roomId: z.string().uuid(),
					limit: z.number().min(1).max(100).optional(),
					before: z.string().datetime().optional(),
				})
			)
			.query(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const limit = input.limit ?? 10;
				const before = input.before ? new Date(input.before) : undefined;
				return queryRecentFights(db, input.roomId, limit, before);
			}),

		fight: protectedProcedure
			.input(
				z.object({
					roomId: z.string().uuid(),
					fightNumber: z.number().int().positive(),
				})
			)
			.query(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const summary = await queryFightByNumber(db, input.roomId, input.fightNumber);
				if (!summary) throw new TRPCError({ code: 'NOT_FOUND' });
				const events = await loadFightEventsForSummary(
					db,
					input.roomId,
					ctx.userId,
					summary.startedAt,
					summary.endedAt
				);
				return { summary, events };
			}),

		monsterFightHistory: protectedProcedure
			.input(
				z.object({
					roomId: z.string().uuid(),
					monsterId: z.string().min(1),
					limit: z.number().min(1).max(50).optional(),
				})
			)
			.query(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				return queryMonsterFightHistory(db, input.roomId, input.monsterId, input.limit ?? 10);
			}),

		catchUp: protectedProcedure
			.input(
				z.object({
					roomId: z.string().uuid(),
					since: z.string().datetime().optional(),
					touchLastSeen: z.boolean().optional(),
				})
			)
			.query(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				let sinceDate: Date;
				if (input.since) {
					sinceDate = new Date(input.since);
				} else {
					const ls = await getMemberLastSeen(db, input.roomId, ctx.userId);
					sinceDate = ls ?? new Date(Date.now() - 60 * 60 * 1000);
				}
				const summaries = await queryFightsSince(db, input.roomId, sinceDate);
				const label = formatSinceLabel(sinceDate);
				const ids = monsterIdsFromSummaries(summaries);
				const streakMap = await computeMonsterWinStreaks(db, input.roomId, ids, STREAK_MIN);
				const streakLines = formatCatchUpStreakLines(streakMap, summaries);
				const { fightCount, textSummary } = buildCatchUpText(summaries, label, streakLines);
				if (input.touchLastSeen !== false) {
					await touchMemberLastSeen(db, input.roomId, ctx.userId);
				}
				return { fightCount, summaries, textSummary };
			}),
	});

	const adminRouter = t.router({
		resetRoom: protectedProcedure
			.input(z.object({ roomId: z.string().uuid() }))
			.mutation(async ({ input, ctx }) => {
				const role = await roomManager.getMemberRole(ctx.userId, input.roomId);
				if (role !== 'owner') {
					throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the room owner can reset game state' });
				}
				await roomManager.resetRoomState(input.roomId);
				return { ok: true };
			}),
	});

	const authRouter = t.router({
		registerConnectorUser: serviceProcedure
			.input(
				z.object({
					connectorType: z.enum(['discord', 'slack']),
					externalId: z.string().min(1),
					displayName: z.string().min(1).max(100),
				})
			)
			.mutation(async ({ input }) => {
				const userId = await ensureConnectorUser(
					input.connectorType,
					input.externalId,
					input.displayName
				);
				return { userId };
			}),
	});

	return t.router({
		room: roomRouter,
		game: gameRouter,
		leaderboard: leaderboardRouter,
		admin: adminRouter,
		auth: authRouter,
		profile: createProfileRouter({ roomManager }),
		health: t.procedure.query(() => ({
			status: 'ok',
			timestamp: new Date().toISOString(),
		})),
	});
}
