import { EventEmitter } from 'node:events';

import { expect } from 'chai';

import { dbIdleClientErrors } from '../metrics/index.js';
import { handleIdleClientErrors } from './pool-errors.js';

describe('handleIdleClientErrors', () => {
	it('keeps an idle connection error from throwing, logs it, and counts it', async () => {
		// Without a listener, EventEmitter throws an emitted 'error': this is what crashed the
		// server in production when the Supabase pooler dropped an idle connection.
		const bare = new EventEmitter();
		expect(() => bare.emit('error', new Error('Connection terminated unexpectedly'))).to.throw(
			'Connection terminated unexpectedly'
		);

		const pool = new EventEmitter();
		const warnings: Array<{ msg: string; extra?: Record<string, unknown> }> = [];
		handleIdleClientErrors(pool, { warn: (msg, extra) => warnings.push({ msg, extra }) });
		const before = (await dbIdleClientErrors.get()).values[0]?.value ?? 0;

		expect(() => pool.emit('error', new Error('Connection terminated unexpectedly'))).not.to.throw();

		expect(warnings).to.have.length(1);
		expect(warnings[0]!.extra).to.deep.equal({ err: 'Connection terminated unexpectedly' });
		expect((await dbIdleClientErrors.get()).values[0]?.value).to.equal(before + 1);
	});
});
