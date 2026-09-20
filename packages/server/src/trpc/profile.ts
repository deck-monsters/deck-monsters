import { TRPCError } from '@trpc/server';
import { createKeyedPromiseQueue } from '@deck-monsters/engine';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db, type Db } from '../db/index.js';
import { profiles } from '../db/schema.js';
import { createLogger } from '../logger.js';
import { publicDisplayName } from '../public-display-name.js';
import type { RoomManager } from '../room-manager.js';
import { protectedProcedure } from './middleware.js';
import { t } from './trpc.js';

const log = createLogger('profile-router');

type ProfileRouterDependencies = {
	db?: Db;
	roomManager: RoomManager;
};

const displayNameSchema = z.object({
	displayName: z.string().trim().min(2).max(32),
});

export function createProfileRouter({ db: database = db, roomManager }: ProfileRouterDependencies) {
	// This is an in-process lane; multi-instance deployments need a DB-side lock or version check.
	const runProfileUpdate = createKeyedPromiseQueue();

	return t.router({
		me: protectedProcedure.query(async ({ ctx }) => {
			const rows = await database
				.select({ displayName: profiles.displayName })
				.from(profiles)
				.where(eq(profiles.id, ctx.userId))
				.limit(1);

			return { displayName: publicDisplayName(rows[0]?.displayName) };
		}),

		updateDisplayName: protectedProcedure.input(displayNameSchema).mutation(async ({ ctx, input }) => {
			if (input.displayName.includes('@')) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: "Display names can't look like an email address.",
				});
			}
			if (!/[\p{L}\p{N}]/u.test(input.displayName)) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Display names must include a letter or number.',
				});
			}

			return runProfileUpdate(`profile:${ctx.userId}`, async () => {
				const rows = await database
					.select({ displayName: profiles.displayName })
					.from(profiles)
					.where(eq(profiles.id, ctx.userId))
					.limit(1);
				const previousDisplayName = rows[0]?.displayName;
				if (previousDisplayName === undefined) {
					throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found.' });
				}
				// `RoomManager.getDisplayName` masks names before character seeding (room-manager.ts:420).
				const previousPublicName = publicDisplayName(previousDisplayName);

				await database
					.update(profiles)
					.set({ displayName: input.displayName })
					.where(eq(profiles.id, ctx.userId));

				// Do not rewrite historical fight summaries, monster-stat names, or event text:
				// those values describe past room-character and monster state, not this profile.
				let renamedCharacters = 0;
				const memberRooms = await roomManager.listRoomsForUser(ctx.userId);
				for (const { roomId } of memberRooms) {
					try {
						await roomManager.runSerializedEngineWork(roomId, async () => {
							const game = await roomManager.getGame(roomId);
							const character = game.characters[ctx.userId];

							// Deliberately narrow: a player who renamed themselves in-game keeps that name.
							// Exact, case-sensitive equality preserves aliases and whitespace differences.
							if (character?.givenName === previousPublicName) {
								character.setOptions({ name: input.displayName });
								game.emit('stateChange', { character });
								renamedCharacters += 1;
							}
						});
					} catch (error) {
						log.error('failed to propagate display name to room character', {
							roomId,
							userId: ctx.userId,
							error: error instanceof Error ? error.message : String(error),
						});
					}
				}

				return { displayName: input.displayName, renamedCharacters };
			});
		}),
	});
}
