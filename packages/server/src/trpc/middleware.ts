import { TRPCError } from '@trpc/server';
import { t } from './trpc.js';

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.userId) {
		throw new TRPCError({ code: 'UNAUTHORIZED' });
	}

	return next({ ctx: { ...ctx, userId: ctx.userId } });
});

export const serviceProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.serviceTokenValid) {
		throw new TRPCError({ code: 'UNAUTHORIZED' });
	}

	return next({ ctx });
});
