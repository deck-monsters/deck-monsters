import { expect } from 'chai';
import sinon from 'sinon';

import { createShutdown } from './shutdown.js';

describe('createShutdown', () => {
	function make(overrides: Record<string, unknown> = {}) {
		const order: string[] = [];
		const deps = {
			server: { close: sinon.stub().callsFake(async () => { order.push('close'); }) },
			roomManager: { flushAll: sinon.stub().callsFake(async () => { order.push('flush'); }) },
			pool: { end: sinon.stub().callsFake(async () => { order.push('pool'); }) },
			log: { info: sinon.stub(), error: sinon.stub() },
			exit: sinon.stub().callsFake(() => { order.push('exit'); }),
			...overrides,
		};
		return { deps, order };
	}

	it('closes the server, flushes rooms with the deadline, ends the pool, then exits 0', async () => {
		const { deps, order } = make();
		await createShutdown(deps as never)('SIGTERM');

		expect(order).to.deep.equal(['close', 'flush', 'pool', 'exit']);
		expect(deps.roomManager.flushAll.firstCall.args[0]).to.equal(8000);
		expect(deps.exit.calledWith(0)).to.be.true;
	});

	it('ignores repeated signals', async () => {
		const { deps } = make();
		const shutdown = createShutdown(deps as never);
		await Promise.all([shutdown('SIGTERM'), shutdown('SIGINT'), shutdown('SIGTERM')]);

		expect(deps.roomManager.flushAll.calledOnce).to.be.true;
		expect(deps.exit.calledOnce).to.be.true;
	});

	it('still flushes and exits when closing the server fails', async () => {
		const { deps, order } = make();
		deps.server.close = sinon.stub().rejects(new Error('boom'));
		await createShutdown(deps as never)('SIGINT');

		expect(order).to.deep.equal(['flush', 'pool', 'exit']);
	});
});
