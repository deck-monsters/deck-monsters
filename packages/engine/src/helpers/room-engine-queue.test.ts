import { expect } from 'chai';

import { createKeyedPromiseQueue } from './room-engine-queue.js';

describe('createKeyedPromiseQueue', () => {
	it('runs tasks with the same key strictly one after another', async () => {
		const run = createKeyedPromiseQueue();
		const order: string[] = [];
		const key = 'room-1';

		const p1 = run(key, async () => {
			order.push('a-start');
			await new Promise(r => setTimeout(r, 20));
			order.push('a-end');
		});

		const p2 = run(key, async () => {
			order.push('b');
		});

		await Promise.all([p1, p2]);

		expect(order).to.deep.equal(['a-start', 'a-end', 'b']);
	});

	it('allows different keys to run concurrently', async () => {
		const run = createKeyedPromiseQueue();
		const events: string[] = [];

		const p1 = run('a', async () => {
			events.push('1-start');
			await new Promise(r => setTimeout(r, 15));
			events.push('1-end');
		});

		const p2 = run('b', async () => {
			events.push('2');
		});

		await Promise.all([p1, p2]);

		expect(events).to.include.members(['1-start', '2']);
		expect(events.indexOf('2')).to.be.lessThan(events.indexOf('1-end')!);
	});

	it('continues the queue after a rejected task', async () => {
		const run = createKeyedPromiseQueue();
		const key = 'room-x';
		const order: string[] = [];

		await run(key, async () => {
			order.push('fail');
			throw new Error('boom');
		}).catch(() => {
			order.push('caught');
		});

		await run(key, async () => {
			order.push('after');
		});

		expect(order).to.deep.equal(['fail', 'caught', 'after']);
	});
});
