import { randomUUID } from 'node:crypto';

import { z } from 'zod';
import { TRPCError, tracked } from '@trpc/server';
import { createLogger } from '../logger.js';

const log = createLogger('router');

import type { GameEvent, EventType, EventScope } from '@deck-monsters/engine';
import { PROMPT_CANCELLED, PromptCancelledError } from '@deck-monsters/engine';
import { buildQuickActions } from '../quick-actions.js';
import { t } from './trpc.js';
import { protectedProcedure, serviceProcedure } from './middleware.js';
import type { RoomManager } from '../room-manager.js';
import { ensureConnectorUser } from '../auth/connector-users.js';
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
	inRing: boolean;
	inEncounter: boolean;
	cardSlots: number;
	cards: string[];
	presets: Record<string, string[]>;
};

type InventorySummary = {
	monsters: InventoryMonsterSummary[];
	unequippedDeck: string[];
	cardCompatibility: Record<string, string[]>;
	items: {
		character: string[];
		monsters: Array<{ monsterName: string; items: string[] }>;
	};
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

			return {
				monster,
				summary: {
					name,
					type:
						typeof record.creatureType === 'string'
							? record.creatureType
							: 'Unknown',
					level:
						typeof record.level === 'number' && Number.isFinite(record.level)
							? record.level
							: 0,
					inRing: inRing.has(monster),
					inEncounter: Boolean(record.inEncounter),
					cardSlots:
						typeof record.cardSlots === 'number' && Number.isFinite(record.cardSlots)
							? record.cardSlots
							: 0,
					cards: cards.map((card) => getDisplayName(card)),
					presets,
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
			items: monsterInventory.map((item) => getDisplayName(item)),
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
		monsters: monsterSummaries,
		unequippedDeck: deck.map((card) => getDisplayName(card)),
		cardCompatibility,
		items: {
			character: items.map((item) => getDisplayName(item)),
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
		// Interactive console flows run in a per-user lane (see the `command`
		// mutation) and can wait minutes on prompt answers. Workshop mutations
		// must not interleave with that user's in-flight flow — fail fast with
		// a clear message instead of silently mutating shared state mid-flow.
		if (activeFlows.has(`${roomId}:${userId}`)) {
			const eventBus = await roomManager.getEventBus(roomId);
			const pendingPrompt = eventBus.getPendingPromptForUser(userId);
			throw new TRPCError({
				code: 'PRECONDITION_FAILED',
				message: pendingPrompt
					? 'A console command is in progress — answer or cancel its prompt first.'
					: 'Still processing your previous command — try again in a moment.',
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
				const rows = await queryRoomPlayers(db, input.roomId, (input.sortBy ?? 'xp') as LeaderboardSort, limit);
				return rows.map((r, i) => ({
					rank: i + 1,
					displayName: r.displayName,
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
				const rows = await queryRoomMonsters(db, input.roomId, (input.sortBy ?? 'xp') as LeaderboardSort, limit);
				const streaks = await computeMonsterWinStreaks(
					db,
					input.roomId,
					rows.map((r) => r.monsterId)
				);
				return rows.map((r, i) => ({
					rank: i + 1,
					monsterId: r.monsterId,
					displayName: r.displayName,
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
				const action = game.handleCommand({ command: input.command });

				if (!action) {
					log.debug('command not recognized', { roomId: input.roomId, command: input.command });
					commandsTotal.inc({ room_id: input.roomId, result: 'rejected' });
					return { ok: false, message: 'Command not recognized' };
				}
				const commandId = randomUUID();
				// The commandId doubles as the flow-lock ownership token — see the
				// activeFlows declaration for why cleanup must be ownership-checked.
				activeFlows.set(flowKey, commandId);
				log.debug('command dispatched', { roomId: input.roomId, userId: ctx.userId, isAdmin });

				// Persist a user-input echo event so console history can show
				// previously submitted commands after reload.
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
						const msg = err instanceof Error ? err.message : String(err);
						if (!isCancelled && !msg.includes('Prompt timed out')) {
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

		myInventory: protectedProcedure
			.input(z.object({ roomId: z.string().uuid() }))
			.query(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const game = await roomManager.getGame(input.roomId);
				const character = game.characters?.[ctx.userId];
				if (!character || typeof character !== 'object') {
					return {
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
				const { removedCount, monsterName } = await runSerializedMutation(input.roomId, ctx.userId, async () => {
					let removedCount = 0;
					let monsterName = input.monsterName;
					for (const { cardName, count } of input.cards) {
						const result = (await character.unequipCard({
							channel,
							cardName,
							monsterName: input.monsterName,
							count,
						})) as { removedCount: number; monsterName: string };
						removedCount += result.removedCount;
						monsterName = result.monsterName;
					}
					return { removedCount, monsterName };
				});
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
					text: `Unequipped ${removedCount} cards from ${monsterName}.`,
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
				return { removedCount, monsterName };
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
				const { movedCount, fromMonsterName, toMonsterName } = await runSerializedMutation(
					input.roomId,
					ctx.userId,
					async () => {
						let movedCount = 0;
						let fromMonsterName = input.fromMonsterName;
						let toMonsterName = input.toMonsterName;
						for (const { cardName, count } of input.cards) {
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
						}
						return { movedCount, fromMonsterName, toMonsterName };
					},
				);
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
					text: `Moved ${movedCount} cards from ${fromMonsterName} to ${toMonsterName}.`,
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
				return { movedCount, fromMonsterName, toMonsterName };
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

		ringFeed: protectedProcedure
			.input(
				z.object({
					roomId: z.string().uuid(),
					lastEventId: z.string().optional(),
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
				const events = await loadFightEventsForSummary(db, input.roomId, summary.startedAt, summary.endedAt);
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
		health: t.procedure.query(() => ({
			status: 'ok',
			timestamp: new Date().toISOString(),
		})),
	});
}
