import { expect } from 'chai';
import { TRPCError } from '@trpc/server';

import { createRouter } from './router.js';

const ROOM_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const USER_ID = '11111111-2222-3333-4444-555555555555';

describe('trpc/router respondToPrompt', () => {
	it('forwards a valid prompt response', async () => {
		const roomManager = {
			assertMember: async () => undefined,
			getEventBus: async () => ({
				respondToPrompt: () => true,
				getPendingPromptForUser: () => null,
			}),
		} as unknown as Parameters<typeof createRouter>[0];

		const router = createRouter(roomManager);
		const caller = router.createCaller({ userId: USER_ID, serviceTokenValid: false });

		const result = await caller.game.respondToPrompt({
			roomId: ROOM_ID,
			requestId: 'req-1',
			answer: '0',
		});

		expect(result).to.deep.equal({ ok: true });
	});

	it('throws PRECONDITION_FAILED when requestId is stale', async () => {
		const roomManager = {
			assertMember: async () => undefined,
			getEventBus: async () => ({
				respondToPrompt: () => false,
				getPendingPromptForUser: () => ({ requestId: 'req-2', question: 'Q', choices: ['0'], timeoutSeconds: 120 }),
			}),
		} as unknown as Parameters<typeof createRouter>[0];

		const router = createRouter(roomManager);
		const caller = router.createCaller({ userId: USER_ID, serviceTokenValid: false });

		const err = await caller.game.respondToPrompt({
			roomId: ROOM_ID,
			requestId: 'req-1',
			answer: '0',
		}).catch((e: unknown) => e);

		expect(err).to.be.instanceOf(TRPCError);
		expect((err as TRPCError).code).to.equal('PRECONDITION_FAILED');
	});
});
