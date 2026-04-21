import { expect } from 'chai';
import { RoomEventBus } from './room-event-bus.js';

const ROOM_ID = 'test-room';

describe('RoomEventBus prompt ownership validation', () => {
	it('respondToPrompt resolves for the correct caller', () => {
		const bus = new RoomEventBus(ROOM_ID);
		const promptPromise = bus.sendPrompt('user-a', 'What color?', [], 5000);

		// Peek at the requestId from pendingPrompts (internal state)
		const requestId = [...(bus as any).pendingPrompts.keys()][0] as string;

		const handled = bus.respondToPrompt(requestId, 'blue', 'user-a');
		expect(handled).to.equal(true);

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
		const handled = bus.respondToPrompt(requestId, 'red', 'user-b');
		expect(handled).to.equal(false);

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
		const handled = bus.respondToPrompt(requestId, 'yes');
		expect(handled).to.equal(true);

		return promptPromise.then((answer) => {
			expect(answer).to.equal('yes');
		});
	});

	it('returns false when requestId is stale or unknown', () => {
		const bus = new RoomEventBus(ROOM_ID);
		const handled = bus.respondToPrompt('missing-request-id', 'yes', 'user-a');
		expect(handled).to.equal(false);
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

describe('RoomEventBus pending prompt snapshots', () => {
	it('returns pending prompt details for a specific user', async () => {
		const bus = new RoomEventBus(ROOM_ID);
		const p = bus.sendPrompt('user-a', 'Choose one', ['0', '1'], 90_000);

		const pending = bus.getPendingPromptForUser('user-a');
		expect(pending).to.deep.equal({
			requestId: pending?.requestId,
			question: 'Choose one',
			choices: ['0', '1'],
			timeoutSeconds: 90,
		});
		expect(pending?.requestId).to.be.a('string').and.not.empty;

		bus.cancelPrompt(pending!.requestId, 'user-a');
		await p;
	});

	it('returns null when the user has no pending prompts', () => {
		const bus = new RoomEventBus(ROOM_ID);
		expect(bus.getPendingPromptForUser('nobody')).to.equal(null);
	});
});

describe('RoomEventBus getEventsSince', () => {
	it('returns slice after id when cursor is in the buffer', () => {
		const bus = new RoomEventBus(ROOM_ID);
		const a = bus.publish({
			type: 'announce',
			scope: 'public',
			text: 'a',
			payload: {},
		});
		const b = bus.publish({
			type: 'announce',
			scope: 'public',
			text: 'b',
			payload: {},
		});
		const c = bus.publish({
			type: 'announce',
			scope: 'public',
			text: 'c',
			payload: {},
		});
		const r = bus.getEventsSince(a.id);
		expect(r.truncated).to.equal(false);
		expect(r.upToDate).to.equal(false);
		expect(r.events.map(e => e.id)).to.deep.equal([b.id, c.id]);
	});

	it('marks truncated when id was evicted and cursor is behind newest', () => {
		const bus = new RoomEventBus(ROOM_ID);
		const oldIds: string[] = [];
		for (let i = 0; i < 210; i++) {
			const e = bus.publish({
				type: 'announce',
				scope: 'public',
				text: `m${i}`,
				payload: {},
			});
			if (i === 0) oldIds.push(e.id);
		}
		const r = bus.getEventsSince(oldIds[0]!);
		expect(r.events).to.have.length(0);
		expect(r.truncated).to.equal(true);
		expect(r.upToDate).to.equal(false);
	});

	it('marks upToDate when cursor is lexicographically newer than buffer tail', () => {
		const bus = new RoomEventBus(ROOM_ID);
		bus.publish({ type: 'announce', scope: 'public', text: 'x', payload: {} });
		const r = bus.getEventsSince('9999999999999-zzzzzzzz');
		expect(r.events).to.have.length(0);
		expect(r.truncated).to.equal(false);
		expect(r.upToDate).to.equal(true);
	});

	it('does not mark truncated when the buffer is empty (fresh bus)', () => {
		const bus = new RoomEventBus(ROOM_ID);
		const r = bus.getEventsSince('any-cursor');
		expect(r.events).to.have.length(0);
		expect(r.truncated).to.equal(false);
		expect(r.upToDate).to.equal(false);
	});
});
