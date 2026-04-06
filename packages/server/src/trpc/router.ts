import { z } from 'zod';
import { TRPCError, tracked } from '@trpc/server';

import type { GameEvent } from '@deck-monsters/engine';
import { t } from './trpc.js';
import { protectedProcedure, serviceProcedure } from './middleware.js';
import type { RoomManager } from '../room-manager.js';
import { ensureConnectorUser } from '../auth/connector-users.js';

export type AppRouter = ReturnType<typeof createRouter>;

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
				await roomManager.assertMember(ctx.userId, input.roomId);
				const info = await roomManager.getRoomInfo(input.roomId);
				if (!info) throw new TRPCError({ code: 'NOT_FOUND' });
				return info;
			}),
	});

	const gameRouter = t.router({
		command: protectedProcedure
			.input(
				z.object({
					roomId: z.string().uuid(),
					command: z.string().min(1),
					channelName: z.string().default('default'),
					isAdmin: z.boolean().default(false),
					isDM: z.boolean().default(false),
					userName: z.string().default('Player'),
				})
			)
			.mutation(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
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
							payload: {},
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
					isAdmin: input.isAdmin,
					isDM: input.isDM,
					user: { id: ctx.userId, name: input.userName },
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

				return { ok: true };
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
				eventBus.respondToPrompt(input.requestId, input.answer);
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
		auth: authRouter,
		health: t.procedure.query(() => ({
			status: 'ok',
			timestamp: new Date().toISOString(),
		})),
	});
}
