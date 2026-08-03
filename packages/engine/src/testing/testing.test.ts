import { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { use as chaiUse } from 'chai';

import {
	PROMPT_CANCELLED,
	PromptCancelledError,
	RoomEventBus,
} from '../events/index.js';
import {
	createRoomCommandRunner,
	createRoomWideCommandRunner,
	createTestChannel,
} from './index.js';

chaiUse(chaiAsPromised);

const ROOM_ID = 'test-room';
const USER_A = 'user-a';
const USER_B = 'user-b';

describe('createTestChannel', () => {
	it('throws PromptCancelledError when sendPrompt resolves with the cancel sentinel', async () => {
		const bus = new RoomEventBus(ROOM_ID);
		const { fn } = createTestChannel(bus, USER_A);

		const promptPromise = fn({ question: 'Pick one', choices: ['a', 'b'] });

		await new Promise<void>(res => setImmediate(res));
		const requestId = [...(bus as any).pendingPrompts.keys()][0] as string;
		bus.cancelPrompt(requestId, USER_A);

		await expect(promptPromise).to.be.rejectedWith(PromptCancelledError);
	});

	it('returns real string answers from sendPrompt', async () => {
		const bus = new RoomEventBus(ROOM_ID);
		const { fn } = createTestChannel(bus, USER_A);

		const promptPromise = fn({ question: 'Pick one', choices: ['a', 'b'] });

		await new Promise<void>(res => setImmediate(res));
		const requestId = [...(bus as any).pendingPrompts.keys()][0] as string;
		bus.respondToPrompt(requestId, 'a', USER_A);

		await expect(promptPromise).to.eventually.equal('a');
	});

	it('never surfaces the cancel sentinel as a resolved answer', async () => {
		const bus = new RoomEventBus(ROOM_ID);
		const { fn } = createTestChannel(bus, USER_A);

		const promptPromise = fn({ question: 'Pick one', choices: ['a'] });

		await new Promise<void>(res => setImmediate(res));
		const requestId = [...(bus as any).pendingPrompts.keys()][0] as string;
		bus.cancelPrompt(requestId, USER_A);

		try {
			await promptPromise;
			expect.fail('should have thrown PromptCancelledError');
		} catch (err) {
			expect(err).to.be.instanceOf(PromptCancelledError);
			expect((err as Error).message).to.not.equal(PROMPT_CANCELLED);
		}
	});
});

describe('createRoomCommandRunner (production-shaped per-user lanes)', () => {
	it('serializes commands for the same roomId and userId', async () => {
		const run = createRoomCommandRunner();
		const order: string[] = [];

		const p1 = run(ROOM_ID, USER_A, async () => {
			order.push('a-start');
			await new Promise(r => setTimeout(r, 20));
			order.push('a-end');
		});

		const p2 = run(ROOM_ID, USER_A, async () => {
			order.push('b');
		});

		await Promise.all([p1, p2]);
		expect(order).to.deep.equal(['a-start', 'a-end', 'b']);
	});

	it('allows different users in the same room to run concurrently', async () => {
		const run = createRoomCommandRunner();
		const events: string[] = [];

		const p1 = run(ROOM_ID, USER_A, async () => {
			events.push('a-start');
			await new Promise(r => setTimeout(r, 15));
			events.push('a-end');
		});

		const p2 = run(ROOM_ID, USER_B, async () => {
			events.push('b');
		});

		await Promise.all([p1, p2]);
		expect(events).to.include.members(['a-start', 'b']);
		expect(events.indexOf('b')).to.be.lessThan(events.indexOf('a-end')!);
	});
});

describe('createRoomWideCommandRunner (explicit room-wide lane)', () => {
	it('serializes all users in a room through one lane key', async () => {
		const run = createRoomWideCommandRunner();
		const order: string[] = [];

		const p1 = run(ROOM_ID, async () => {
			order.push('a-start');
			await new Promise(r => setTimeout(r, 20));
			order.push('a-end');
		});

		const p2 = run(ROOM_ID, async () => {
			order.push('b');
		});

		await Promise.all([p1, p2]);
		expect(order).to.deep.equal(['a-start', 'a-end', 'b']);
	});
});
