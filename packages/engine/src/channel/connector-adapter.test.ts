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
});
