import { z } from 'zod';

export const commandInputSchema = z.looseObject({
	command: z.string().optional(),
});

export type CommandInput = z.infer<typeof commandInputSchema>;
