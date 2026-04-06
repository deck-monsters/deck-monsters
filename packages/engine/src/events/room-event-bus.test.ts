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
