import { z } from 'zod';

export const gameStateSchema = z
	.object({
		options: z
			.object({
				characters: z.record(z.string(), z.unknown()).optional(),
			})
			.passthrough()
			.optional(),
	})
	.passthrough();

export type GameStateInput = z.infer<typeof gameStateSchema>;
