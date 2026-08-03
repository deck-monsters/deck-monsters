import { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { use as chaiUse } from 'chai';

import {
	PROMPT_CANCELLED,
	PromptCancelledError,
	RoomEventBus,
} from '../events/index.js';
import { ConnectorAdapter } from './connector-adapter.js';
import { createTestChannel } from '../testing/index.js';
import type { ChannelCallback } from './index.js';

chaiUse(chaiAsPromised);

const ROOM_ID = 'adapter-room';
const USER_A = 'user-a';

describe('ConnectorAdapter prompt delivery', () => {
	const noopPublic: ChannelCallback = async () => undefined;

	it('responds to sendPrompt when the private channel returns a string', async () => {
		const bus = new RoomEventBus(ROOM_ID);
		const adapter = new ConnectorAdapter(bus, noopPublic);
		adapter.registerUser(USER_A, async ({ question }) => {
			if (question) return 'yes';
		});

		const answerPromise = bus.sendPrompt(USER_A, 'Pick one', ['yes', 'no'], 5_000);

		await expect(answerPromise).to.eventually.equal('yes');
		adapter.dispose();
	});

	it('cancels the bus prompt promptly when the private channel rejects', async () => {
		const bus = new RoomEventBus(ROOM_ID);
		const errors: unknown[] = [];
		const adapter = new ConnectorAdapter(bus, noopPublic, 'test-adapter', (err) => {
			errors.push(err);
		});

		const rejectChannel: ChannelCallback = async ({ question }) => {
			if (question) {
				throw new Error('DM collector failed');
			}
		};
		adapter.registerUser(USER_A, rejectChannel);

		const start = Date.now();
		const answerPromise = bus.sendPrompt(USER_A, 'Pick one', ['a'], 120_000);

		await new Promise<void>(res => setImmediate(res));
		await expect(answerPromise).to.eventually.equal(PROMPT_CANCELLED);
		expect(Date.now() - start).to.be.lessThan(500);

		expect(errors).to.have.length(1);
		expect((errors[0] as Error).message).to.equal('DM collector failed');
		adapter.dispose();
	});

	it('cancels the bus prompt promptly when the private channel resolves non-string', async () => {
		const bus = new RoomEventBus(ROOM_ID);
		const errors: unknown[] = [];
		const adapter = new ConnectorAdapter(bus, noopPublic, 'test-adapter', (err) => {
			errors.push(err);
		});

		const undefinedChannel: ChannelCallback = async ({ question }) => {
			if (question) return undefined;
		};
		adapter.registerUser(USER_A, undefinedChannel);

		const start = Date.now();
		const answerPromise = bus.sendPrompt(USER_A, 'Pick one', ['a'], 120_000);

		await new Promise<void>(res => setImmediate(res));
		await expect(answerPromise).to.eventually.equal(PROMPT_CANCELLED);
		expect(Date.now() - start).to.be.lessThan(500);

		expect(errors).to.have.length(1);
		adapter.dispose();
	});

	it('production-shaped createTestChannel throws PromptCancelledError when adapter cancels on reject', async () => {
		const bus = new RoomEventBus(ROOM_ID);
		const adapter = new ConnectorAdapter(bus, noopPublic);

		const { fn } = createTestChannel(bus, USER_A);
		adapter.registerUser(USER_A, async ({ question }) => {
			if (question) throw new Error('connector blew up');
		});

		const promptPromise = fn({ question: 'Name?', choices: [] });
		await new Promise<void>(res => setImmediate(res));

		await expect(promptPromise).to.be.rejectedWith(PromptCancelledError);
		adapter.dispose();
	});

	it('cancels the bus prompt when the private channel resolves PROMPT_CANCELLED', async () => {
		const bus = new RoomEventBus(ROOM_ID);
		const adapter = new ConnectorAdapter(bus, noopPublic);
		adapter.registerUser(USER_A, async ({ question }) => {
			if (question) return PROMPT_CANCELLED;
		});

		const answerPromise = bus.sendPrompt(USER_A, 'Pick one', ['a'], 5_000);
		await expect(answerPromise).to.eventually.equal(PROMPT_CANCELLED);
		adapter.dispose();
	});

	it('settles the prompt before invoking onChannelError', async () => {
		const bus = new RoomEventBus(ROOM_ID);
		const adapter = new ConnectorAdapter(bus, noopPublic, 'test-adapter', () => {
			expect(
				(bus as any).pendingPrompts.size,
				'pending prompt should be cleared before onChannelError',
			).to.equal(0);
		});
		adapter.registerUser(USER_A, async ({ question }) => {
			if (question) throw new Error('connector blew up');
		});

		const answerPromise = bus.sendPrompt(USER_A, 'Pick one', ['a'], 120_000);
		await new Promise<void>(res => setImmediate(res));
		await expect(answerPromise).to.eventually.equal(PROMPT_CANCELLED);
		adapter.dispose();
	});

	it('still settles the prompt when onChannelError throws', async () => {
		const bus = new RoomEventBus(ROOM_ID);
		const adapter = new ConnectorAdapter(bus, noopPublic, 'test-adapter', () => {
			throw new Error('logging callback blew up');
		});
		adapter.registerUser(USER_A, async ({ question }) => {
			if (question) throw new Error('connector blew up');
		});

		const answerPromise = bus.sendPrompt(USER_A, 'Pick one', ['a'], 120_000);
		await new Promise<void>(res => setImmediate(res));
		await expect(answerPromise).to.eventually.equal(PROMPT_CANCELLED);
		adapter.dispose();
	});
});

describe('ConnectorAdapter topology and lifecycle', () => {
	const USER_B = 'user-b';

	function trackChannel(): { fn: ChannelCallback; announces: string[]; questions: string[] } {
		const announces: string[] = [];
		const questions: string[] = [];
		const fn: ChannelCallback = async ({ announce, question }) => {
			if (announce) announces.push(announce);
			if (question) questions.push(question);
		};
		return { fn, announces, questions };
	}

	it('routes public events only to the public channel', async () => {
		const bus = new RoomEventBus(ROOM_ID);
		const publicCalls: string[] = [];
		const userA = trackChannel();
		const userB = trackChannel();
		const adapter = new ConnectorAdapter(bus, async ({ announce }) => {
			if (announce) publicCalls.push(announce);
		});
		adapter.registerUser(USER_A, userA.fn);
		adapter.registerUser(USER_B, userB.fn);

		bus.publish({
			type: 'announce',
			scope: 'public',
			text: 'ring update',
			payload: {},
		});
		await new Promise<void>(res => setImmediate(res));

		expect(publicCalls).to.deep.equal(['ring update']);
		expect(userA.announces).to.deep.equal([]);
		expect(userB.announces).to.deep.equal([]);
		adapter.dispose();
	});

	it('routes private events only to the matching registered user', async () => {
		const bus = new RoomEventBus(ROOM_ID);
		const userA = trackChannel();
		const userB = trackChannel();
		const adapter = new ConnectorAdapter(bus, async () => undefined);
		adapter.registerUser(USER_A, userA.fn);
		adapter.registerUser(USER_B, userB.fn);

		bus.publish({
			type: 'announce',
			scope: 'private',
			targetUserId: USER_A,
			text: 'only for A',
			payload: {},
		});
		await new Promise<void>(res => setImmediate(res));

		expect(userA.announces).to.deep.equal(['only for A']);
		expect(userB.announces).to.deep.equal([]);
		adapter.dispose();
	});

	it('unregisterUser removes the per-user subscription', async () => {
		const bus = new RoomEventBus(ROOM_ID);
		const userA = trackChannel();
		const adapter = new ConnectorAdapter(bus, async () => undefined);
		adapter.registerUser(USER_A, userA.fn);

		bus.publish({
			type: 'announce',
			scope: 'private',
			targetUserId: USER_A,
			text: 'before unregister',
			payload: {},
		});
		await new Promise<void>(res => setImmediate(res));
		expect(userA.announces).to.deep.equal(['before unregister']);

		adapter.unregisterUser(USER_A);
		bus.publish({
			type: 'announce',
			scope: 'private',
			targetUserId: USER_A,
			text: 'after unregister',
			payload: {},
		});
		await new Promise<void>(res => setImmediate(res));
		expect(userA.announces).to.deep.equal(['before unregister']);
		adapter.dispose();
	});

	it('re-register replaces the channel without duplicate delivery', async () => {
		const bus = new RoomEventBus(ROOM_ID);
		const first = trackChannel();
		const second = trackChannel();
		const adapter = new ConnectorAdapter(bus, async () => undefined);
		adapter.registerUser(USER_A, first.fn);
		adapter.registerUser(USER_A, second.fn);

		bus.publish({
			type: 'announce',
			scope: 'private',
			targetUserId: USER_A,
			text: 'hello',
			payload: {},
		});
		await new Promise<void>(res => setImmediate(res));

		expect(first.announces).to.deep.equal([]);
		expect(second.announces).to.deep.equal(['hello']);
		adapter.dispose();
	});

	it('dispose removes public and all per-user subscriptions', async () => {
		const bus = new RoomEventBus(ROOM_ID);
		const publicCalls: string[] = [];
		const userA = trackChannel();
		const userB = trackChannel();
		const adapter = new ConnectorAdapter(bus, async ({ announce }) => {
			if (announce) publicCalls.push(announce);
		});
		adapter.registerUser(USER_A, userA.fn);
		adapter.registerUser(USER_B, userB.fn);
		adapter.dispose();

		bus.publish({
			type: 'announce',
			scope: 'public',
			text: 'after dispose',
			payload: {},
		});
		bus.publish({
			type: 'announce',
			scope: 'private',
			targetUserId: USER_A,
			text: 'private after dispose',
			payload: {},
		});
		await new Promise<void>(res => setImmediate(res));

		expect(publicCalls).to.deep.equal([]);
		expect(userA.announces).to.deep.equal([]);
		expect(userB.announces).to.deep.equal([]);
	});
});
