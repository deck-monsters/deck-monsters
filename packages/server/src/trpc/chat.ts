import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { ChatError, type ChatService } from '../chat/chat-service.js';
import type { RoomManager } from '../room-manager.js';
import { protectedProcedure } from './middleware.js';
import { t } from './trpc.js';

/**
 * Room chat procedures (roadmap 41). Every procedure `assertMember`s first
 * (docs/architecture/rooms-and-identity.md); the service filters every query by room and by
 * what the caller may see (room messages, and DMs they sent or received).
 */
export function createChatRouter({ roomManager, chat }: { roomManager: RoomManager; chat: ChatService }) {
	const roomInput = z.object({ roomId: z.string().uuid() });

	return t.router({
		send: protectedProcedure
			.input(
				z.object({
					roomId: z.string().uuid(),
					// The service enforces the 500-character limit with its own player-facing
					// text; this bound only stops an absurd payload reaching it.
					text: z.string().max(5000),
					toUserId: z.string().uuid().optional(),
				})
			)
			.mutation(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				try {
					return await chat.send({
						roomId: input.roomId,
						senderUserId: ctx.userId,
						text: input.text,
						toUserId: input.toUserId,
						source: 'web',
					});
				} catch (err) {
					if (err instanceof ChatError) {
						// `cause` carries the code so the client can branch without parsing text.
						throw new TRPCError({ code: 'BAD_REQUEST', message: err.message, cause: err });
					}
					throw err;
				}
			}),

		history: protectedProcedure
			.input(
				roomInput.extend({
					beforeId: z.number().int().positive().optional(),
					afterId: z.number().int().nonnegative().optional(),
					limit: z.number().int().min(1).max(200).optional(),
				})
			)
			.query(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const [messages, lastReadId, unread] = await Promise.all([
					chat.history({
						roomId: input.roomId,
						userId: ctx.userId,
						beforeId: input.beforeId,
						afterId: input.afterId,
						limit: input.limit,
					}),
					chat.lastReadId(input.roomId, ctx.userId),
					chat.unreadCount(input.roomId, ctx.userId),
				]);
				return { messages, lastReadId, unread };
			}),

		markRead: protectedProcedure
			.input(roomInput.extend({ lastReadId: z.number().int().nonnegative() }))
			.mutation(async ({ input, ctx }) => {
				await roomManager.assertMember(ctx.userId, input.roomId);
				const lastReadId = await chat.markRead(input.roomId, ctx.userId, input.lastReadId);
				return { lastReadId, unread: await chat.unreadCount(input.roomId, ctx.userId) };
			}),

		unread: protectedProcedure.input(roomInput).query(async ({ input, ctx }) => {
			await roomManager.assertMember(ctx.userId, input.roomId);
			return {
				unread: await chat.unreadCount(input.roomId, ctx.userId),
				lastReadId: await chat.lastReadId(input.roomId, ctx.userId),
			};
		}),

		// What the Console's `dm` preview matches against: the very candidate list the server
		// resolves with (names of current room members, the caller included).
		dmNames: protectedProcedure.input(roomInput).query(async ({ input, ctx }) => {
			await roomManager.assertMember(ctx.userId, input.roomId);
			return chat.dmCandidates(input.roomId);
		}),

		members: protectedProcedure.input(roomInput).query(async ({ input, ctx }) => {
			await roomManager.assertMember(ctx.userId, input.roomId);
			return chat.members(input.roomId, ctx.userId);
		}),
	});
}
