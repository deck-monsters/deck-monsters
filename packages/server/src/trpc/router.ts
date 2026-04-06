import { randomUUID } from 'node:crypto';

import { z } from 'zod';
import { TRPCError, tracked } from '@trpc/server';

import type { GameEvent, EventType, EventScope } from '@deck-monsters/engine';
import { t } from './trpc.js';
import { protectedProcedure, serviceProcedure } from './middleware.js';
import type { RoomManager } from '../room-manager.js';
import { ensureConnectorUser } from '../auth/connector-users.js';

export type AppRouter = ReturnType<typeof createRouter>;

// Increment when the client<->server protocol changes in a breaking way.
const PROTOCOL_VERSION = 1;
const BUILD_VERSION = process.env['BUILD_VERSION'] ?? 'dev';

// Per-user active-flow lock.  Key = `${roomId}:${userId}`.
// While a command flow is in progress for a given user+room, further commands
// are rejected with a friendly message so users know to answer the prompt first.
// Exported so it can be inspected in unit tests.
export const activeFlows = new Set<string>();

export function createRouter(roomManager: RoomManager) {
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
				const [role, displayName] = await Promise.all([
					roomManager.getMemberRole(ctx.userId, input.roomId),
					roomManager.getDisplayName(ctx.userId),
				]);
				const isAdmin = role === 'owner';
				const game = await roomManager.getGame(input.roomId);
				const eventBus = await roomManager.getEventBus(input.roomId);
				const action = game.handleCommand({ command: input.command });

				if (!action) {
					return { ok: false, message: 'Command not recognized' };
				}

				// Prevent concurrent interactive flows for the same user+room.
				// The engine is not designed for concurrent access — interleaved prompt
				// flows corrupt game state and produce nonsensical UX.
				const flowKey = `${input.roomId}:${ctx.userId}`;
				if (activeFlows.has(flowKey)) {
					return {
						ok: false,
						message: 'A command is already in progress — answer the current prompt first.',
					};
				}
				activeFlows.add(flowKey);

				const commandId = randomUUID();

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
				void action({
					channel,
					channelName: input.channelName,
					isAdmin,
					isDM: input.isDM,
					user: { id: ctx.userId, name: displayName },
				})
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

				return { ok: true, commandId };
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

		ringFeed: protectedProcedure
			.input(
				z.object({
					roomId: z.string().uuid(),
					lastEventId: z.string().optional(),
				})
			)
			.subscription(async function* ({ input, ctx, signal }) {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const eventBus = await roomManager.getEventBus(input.roomId);

				// Emit handshake event first so the client can verify protocol compatibility.
				const handshakeEvent: GameEvent = {
					id: 'handshake',
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
					},
				};
				yield tracked('handshake', handshakeEvent);

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
					const recent = eventBus.getRecentEvents(20);
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

				try {
					while (!signal?.aborted) {
						while (queue.length > 0) {
							const event = queue.shift()!;
							yield tracked(event.id, event);
						}

						await new Promise<void>((res) => {
							resolve = res;
							signal?.addEventListener('abort', () => res(), { once: true });
						});
					}
				} finally {
					unsubscribe();
				}
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
		admin: adminRouter,
		auth: authRouter,
		health: t.procedure.query(() => ({
			status: 'ok',
			timestamp: new Date().toISOString(),
		})),
	});
}
