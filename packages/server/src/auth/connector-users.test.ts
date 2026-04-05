import { expect } from 'chai';
import sinon from 'sinon';

import { ensureConnectorUser } from './connector-users.js';

// Build a minimal Drizzle-style chainable query stub.
// ensureConnectorUser calls: db.select(...).from(...).where(...)  → Promise<row[]>
// and db.insert(...).values(...)                                   → Promise<void>
function makeDbStub(selectResult: Array<{ userId: string }>) {
	const whereStub = sinon.stub().resolves(selectResult);
	const fromStub = sinon.stub().returns({ where: whereStub });
	const selectStub = sinon.stub().returns({ from: fromStub });

	const valuesStub = sinon.stub().resolves([]);
	const insertStub = sinon.stub().returns({ values: valuesStub });

	return {
		select: selectStub,
		insert: insertStub,
		_stubs: { selectStub, fromStub, whereStub, insertStub, valuesStub },
	};
}

describe('auth/connector-users.ts', () => {
	const originalSupabaseUrl = process.env['SUPABASE_URL'];
	const originalServiceRoleKey = process.env['SUPABASE_SECRET_KEY'];

	afterEach(() => {
		sinon.restore();
		// Restore env vars
		if (originalSupabaseUrl === undefined) delete process.env['SUPABASE_URL'];
		else process.env['SUPABASE_URL'] = originalSupabaseUrl;

		if (originalServiceRoleKey === undefined) delete process.env['SUPABASE_SECRET_KEY'];
		else process.env['SUPABASE_SECRET_KEY'] = originalServiceRoleKey;
	});

	describe('when the connector user already exists', () => {
		it('returns the existing userId without calling Supabase Auth', async () => {
			const db = makeDbStub([{ userId: 'existing-uuid' }]);

			const result = await ensureConnectorUser(
				'discord',
				'discord-user-123',
				'TestUser',
				db as never
			);

			expect(result).to.equal('existing-uuid');
			expect(db._stubs.insertStub.called).to.be.false;
		});
	});

	describe('when the connector user does not exist', () => {
		it('throws when SUPABASE_URL is missing', async () => {
			delete process.env['SUPABASE_URL'];
			delete process.env['SUPABASE_SECRET_KEY'];

			const db = makeDbStub([]);

			await expect(
				ensureConnectorUser('discord', 'new-discord-user', 'NewUser', db as never)
			).to.be.rejectedWith('SUPABASE_URL and SUPABASE_SECRET_KEY are required');
		});

		it('throws when SUPABASE_SECRET_KEY is missing', async () => {
			process.env['SUPABASE_URL'] = 'https://example.supabase.co';
			delete process.env['SUPABASE_SECRET_KEY'];

			const db = makeDbStub([]);

			await expect(
				ensureConnectorUser('discord', 'new-discord-user', 'NewUser', db as never)
			).to.be.rejectedWith('SUPABASE_URL and SUPABASE_SECRET_KEY are required');
		});
	});
});
