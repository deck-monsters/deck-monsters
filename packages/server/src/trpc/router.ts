import { randomUUID } from 'node:crypto';

import { z } from 'zod';
import { TRPCError, tracked } from '@trpc/server';
import { createLogger } from '../logger.js';

const log = createLogger('router');

import type { GameEvent, EventType, EventScope } from '@deck-monsters/engine';
import { t } from './trpc.js';
import { protectedProcedure, serviceProcedure } from './middleware.js';
import type { RoomManager } from '../room-manager.js';
import { ensureConnectorUser } from '../auth/connector-users.js';
import { commandsTotal, wsConnectionsActive } from '../metrics/index.js';
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

export type AppRouter = ReturnType<typeof createRouter>;

// Increment when the client<->server protocol changes in a breaking way.
const PROTOCOL_VERSION = 1;
const BUILD_VERSION = process.env['BUILD_VERSION'] ?? 'dev';

// Per-user active-flow lock.  Key = `${roomId}:${userId}`.
// While a command flow is in progress for a given user+room, further commands
// are rejected with a friendly message so users know to answer the prompt first.
// Exported so it can be inspected in unit tests.
//
// Engine work is additionally serialized **per room** via
// `RoomManager.runSerializedEngineWork` so two users cannot interleave commands
// on the same Game (see packages/engine/src/helpers/room-engine-queue.ts).
export const activeFlows = new Set<string>();

const sortBySchema = z.enum(['xp', 'wins', 'winRate', 'coins']);

export function createRouter(roomManager: RoomManager) {
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
						message: 'A command is already in progress — answer the current prompt first.',
						pendingPrompt,
					};
				}
				const action = game.handleCommand({ command: input.command });

				if (!action) {
					log.debug('command not recognized', { roomId: input.roomId, command: input.command });
					commandsTotal.inc({ room_id: input.roomId, result: 'rejected' });
					return { ok: false, message: 'Command not recognized' };
				}
				activeFlows.add(flowKey);
				log.debug('command dispatched', { roomId: input.roomId, userId: ctx.userId, isAdmin });

				const commandId = randomUUID();

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
						return eventBus.sendPrompt(ctx.userId, question, choiceKeys);
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
				// Serialize all engine work per room so two users cannot interleave
				// handleCommand / ring combat on the same Game (fixes out-of-order ring feed).
				void roomManager
					.runSerializedEngineWork(input.roomId, () =>
						action({
							channel,
							channelName: input.channelName,
							isAdmin,
							isDM: input.isDM,
							user: { id: ctx.userId, name: displayName },
						})
					)
					.catch((err: unknown) => {
						// Prompt timeouts are expected when users abandon a flow.
						const msg = err instanceof Error ? err.message : String(err);
						if (!msg.includes('Prompt timed out')) {
							roomManager['log']?.(err);
						}
					})
					.finally(() => {
						activeFlows.delete(flowKey);
					});

				// TODO: emit quick_actions event after command completes with contextual suggestions

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
				eventBus.respondToPrompt(input.requestId, input.answer, ctx.userId);
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
					.map((monster: { givenName?: unknown; dead?: unknown }) => ({
						name: String(monster?.givenName ?? '').trim(),
						dead: Boolean(monster?.dead),
						inRing: inRing.has(monster),
					}))
					.filter((monster: { name: string }) => monster.name.length > 0);
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
			const handshakeId = `handshake-${Date.now()}`;
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

				// Deliver any missed events since the last received event ID.
				if (input.lastEventId) {
					const missed = eventBus.getEventsSince(input.lastEventId);
					for (const event of missed) {
						if (
							event.scope === 'public' ||
							event.targetUserId === ctx.userId
						) {
							yield tracked(event.id, event);
						}
					}
				} else {
					const recent = eventBus.getRecentEvents(100);
					for (const event of recent) {
						if (
							event.scope === 'public' ||
							event.targetUserId === ctx.userId
						) {
							yield tracked(event.id, event);
						}
					}
				}

				// Stream live events until the client disconnects.
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

				wsConnectionsActive.inc({ room_id: input.roomId });
				try {
					while (!signal?.aborted) {
						while (queue.length > 0) {
							const event = queue.shift()!;
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
							const hbId = `heartbeat-${Date.now()}-${ctx.userId}`;
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
