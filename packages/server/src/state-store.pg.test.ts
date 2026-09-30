import { randomUUID } from 'node:crypto';

import { expect } from 'chai';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import type { Db } from './db/index.js';
import * as schema from './db/schema.js';
import { nextStateVersion, PostgresStateStore } from './state-store.js';

// Real-Postgres check for roadmap 37 task 4. Skipped unless TEST_DATABASE_URL is set, so CI
// without a database stays green. It proves what the fake-DB tests cannot: that the node-postgres
// driver stores the state as a jsonb OBJECT (not a double-encoded string) and that the
// `state_version <` guard rejects an older snapshot that lands last.
const url = process.env['TEST_DATABASE_URL'];
const suite = url ? describe : describe.skip;

suite('PostgresStateStore against Postgres', () => {
	const pool = new pg.Pool({ connectionString: url });
	const db = drizzle(pool, { schema }) as unknown as Db;
	const userId = randomUUID();
	const roomId = randomUUID();
	const store = new PostgresStateStore(db);

	async function row() {
		const res = await pool.query(
			`select jsonb_typeof(state) as type, state, state_version, state_blob from rooms where id = $1`,
			[roomId]
		);
		return res.rows[0];
	}

	before(async () => {
		await pool.query(`insert into auth.users (id) values ($1)`, [userId]);
		await pool.query(`insert into profiles (id, display_name) values ($1, 'pg-test') on conflict (id) do nothing`, [userId]);
		await pool.query(
			`insert into rooms (id, name, owner_id, invite_code) values ($1, 'pg-test', $2, $3)`,
			[roomId, userId, roomId.slice(0, 8)]
		);
	});

	after(async () => {
		await pool.query(`delete from rooms where id = $1`, [roomId]);
		await pool.query(`delete from auth.users where id = $1`, [userId]);
		await pool.end();
	});

	it('stores a jsonb object and a version, leaves state_blob untouched; load returns the object', async () => {
		const state = { name: 'Game', options: { roomId, characters: { a: { name: 'A', options: { xp: 3 } } } } };
		await pool.query(`update rooms set state_blob = 'stale-blob' where id = $1`, [roomId]);
		await store.save(roomId, state);

		const r = await row();
		expect(r.type).to.equal('object');
		expect(Number(r.state_version)).to.be.greaterThan(0);
		expect(r.state).to.deep.equal(state);
		// Release 2 of roadmap 37: a save no longer touches the legacy column.
		expect(r.state_blob).to.equal('stale-blob');
		expect(await store.load(roomId)).to.deep.equal(state);
	});

	it('an older snapshot that lands after a newer one does not overwrite it', async () => {
		const older = { name: 'Game', options: { marker: 'older' } };
		const newer = { name: 'Game', options: { marker: 'newer' } };
		const vOlder = nextStateVersion();
		const vNewer = nextStateVersion();

		await store.write(roomId, newer, vNewer);
		await store.write(roomId, older, vOlder);

		const r = await row();
		expect(r.state.options.marker).to.equal('newer');
		expect(Number(r.state_version)).to.equal(vNewer);
	});

	it('a tombstone version blocks a save stamped before it', async () => {
		const stale = nextStateVersion();
		const tombstone = nextStateVersion();
		await pool.query(`update rooms set state = null, state_blob = null, state_version = $2 where id = $1`, [roomId, tombstone]);

		await store.write(roomId, { name: 'Game', options: {} }, stale);

		const r = await row();
		expect(r.state).to.equal(null);
	});
});
