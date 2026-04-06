import { expect } from 'chai';
import { RoomEventBus } from './room-event-bus.js';

const ROOM_ID = 'test-room';

describe('RoomEventBus prompt ownership validation', () => {
	it('respondToPrompt resolves for the correct caller', () => {
		const bus = new RoomEventBus(ROOM_ID);
		const promptPromise = bus.sendPrompt('user-a', 'What color?', [], 5000);

		// Peek at the requestId from pendingPrompts (internal state)
		const requestId = [...(bus as any).pendingPrompts.keys()][0] as string;

		bus.respondToPrompt(requestId, 'blue', 'user-a');

		return promptPromise.then((answer) => {
			expect(answer).to.equal('blue');
		});
	});

	it('respondToPrompt is a no-op when called by the wrong user', async () => {
		const bus = new RoomEventBus(ROOM_ID);
		let resolved = false;
		let rejected = false;

		const promptPromise = bus.sendPrompt('user-a', 'What color?', [], 200);
		promptPromise.then(() => { resolved = true; }).catch(() => { rejected = true; });

		const requestId = [...(bus as any).pendingPrompts.keys()][0] as string;

		// Wrong caller — should be ignored
		bus.respondToPrompt(requestId, 'red', 'user-b');

		// Give a tick to let any spurious resolution happen
		await new Promise(r => setTimeout(r, 20));
		expect(resolved).to.be.false;

		// Clean up
		bus.cancelPrompt(requestId, 'user-a');
		await new Promise(r => setTimeout(r, 10));
		expect(rejected).to.be.false; // cancel resolves with __cancelled__, not reject
	});

	it('cancelPrompt is a no-op when called by the wrong user', async () => {
		const bus = new RoomEventBus(ROOM_ID);
		let resolved = false;

		const promptPromise = bus.sendPrompt('user-a', 'Another question?', [], 300);
		promptPromise.then(() => { resolved = true; }).catch(() => {});

		const requestId = [...(bus as any).pendingPrompts.keys()][0] as string;

		// Wrong caller
		bus.cancelPrompt(requestId, 'user-b');

		await new Promise(r => setTimeout(r, 20));
		expect(resolved).to.be.false;
		expect((bus as any).pendingPrompts.has(requestId)).to.be.true;

		// Clean up
		bus.cancelPrompt(requestId, 'user-a');
		await new Promise(r => setTimeout(r, 10));
	});

	it('respondToPrompt works without callerId (backwards compat)', () => {
		const bus = new RoomEventBus(ROOM_ID);
		const promptPromise = bus.sendPrompt('user-a', 'Q?', [], 5000);

		const requestId = [...(bus as any).pendingPrompts.keys()][0] as string;
		bus.respondToPrompt(requestId, 'yes');

		return promptPromise.then((answer) => {
			expect(answer).to.equal('yes');
		});
	});
});

describe('RoomEventBus cancelAllUserPrompts', () => {
	it('cancels all pending prompts for the specified user', async () => {
		const bus = new RoomEventBus(ROOM_ID);

		const p1 = bus.sendPrompt('user-a', 'Q1?', [], 5000);
		const p2 = bus.sendPrompt('user-a', 'Q2?', [], 5000);
		const p3 = bus.sendPrompt('user-b', 'Q3?', [], 5000);

		// All three are now pending
		expect((bus as any).pendingPrompts.size).to.equal(3);

		bus.cancelAllUserPrompts('user-a');

		const [r1, r2] = await Promise.all([p1, p2]);
		expect(r1).to.equal('__cancelled__');
		expect(r2).to.equal('__cancelled__');

		// user-b prompt still pending
		expect((bus as any).pendingPrompts.size).to.equal(1);

		// Clean up
		const remainingId = [...(bus as any).pendingPrompts.keys()][0] as string;
		bus.cancelPrompt(remainingId, 'user-b');
	});

	it('is a no-op when no prompts are pending for that user', () => {
		const bus = new RoomEventBus(ROOM_ID);
		expect(() => bus.cancelAllUserPrompts('nobody')).to.not.throw();
	});
});

describe('RoomEventBus sendPrompt payload', () => {
	it('includes timeoutSeconds in the prompt.request event payload', () => {
		const bus = new RoomEventBus(ROOM_ID);
		const published: any[] = [];
		bus.subscribe('spy', { userId: 'user-a', deliver: (e) => published.push(e) });

		const p = bus.sendPrompt('user-a', 'Ready?', ['yes', 'no'], 60_000);

		const requestEvent = published.find(e => e.type === 'prompt.request');
		expect(requestEvent).to.exist;
		expect(requestEvent.payload.timeoutSeconds).to.equal(60);

		// Clean up
		const requestId = requestEvent.payload.requestId;
		bus.cancelPrompt(requestId, 'user-a');
		return p.then((a) => expect(a).to.equal('__cancelled__'));
	});
});
