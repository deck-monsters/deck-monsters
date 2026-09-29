import { expect } from 'chai';

import { installShutdown } from '../shutdown-wiring.js';

describe('installShutdown', () => {
	it('closes the client, flushes rooms, ends the pool, then exits, on SIGTERM and SIGINT', async () => {
		const calls: string[] = [];
		const handlers: Record<string, () => void> = {};
		const exits: number[] = [];
		installShutdown(
			{
				bot: { stop: async () => void calls.push('bot') },
				roomManager: { flushAll: async () => void calls.push('flush') },
				pool: { end: async () => void calls.push('pool') },
				log: { info: () => {}, error: () => {} },
				exit: code => void exits.push(code),
			},
			{ on: (signal, handler) => void (handlers[signal] = handler) }
		);
		expect(Object.keys(handlers).sort()).to.deep.equal(['SIGINT', 'SIGTERM']);

		handlers['SIGTERM']!();
		handlers['SIGINT']!(); // a repeated signal is ignored
		await new Promise(resolve => setTimeout(resolve, 10));
		expect(calls).to.deep.equal(['bot', 'flush', 'pool']);
		expect(exits).to.deep.equal([0]);
	});
});
