import { randomUUID } from 'node:crypto';

import { expect } from 'chai';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import type { Db } from './db/index.js';
import * as schema from './db/schema.js';
import { RoomManager } from './room-manager.js';

// Real-Postgres check (roadmap 37 release 2): a reset nulls the stale `state_blob` (so neither
// the read-only blob fallback nor a rollback can resurrect reset data) but keeps the last copy
// recoverable in `quarantined_blob`. Skipped unless TEST_DATABASE_URL is set.
const url = process.env['TEST_DATABASE_URL'];
const suite = url ? describe : describe.skip;

suite('RoomManager reset against Postgres', () => {
	const pool = new pg.Pool({ connectionString: url });
	const db = drizzle(pool, { schema }) as unknown as Db;
	const userId = randomUUID();
	const roomId = randomUUID();

	before(async () => {
		await pool.query(`insert into auth.users (id) values ($1)`, [userId]);
		await pool.query(`insert into profiles (id, display_name) values ($1, 'pg-test') on conflict (id) do nothing`, [userId]);
		await pool.query(
			`insert into rooms (id, name, owner_id, invite_code, state_blob) values ($1, 'pg-test', $2, $3, 'the-only-copy')`,
			[roomId, userId, roomId.slice(0, 8)]
		);
	});

	after(async () => {
		await pool.query(`delete from rooms where id = $1`, [roomId]);
		await pool.query(`delete from auth.users where id = $1`, [userId]);
		await pool.end();
	});

	it('nulls state_blob, keeps it in quarantined_blob, and leaves state null with a tombstone version', async () => {
		await new RoomManager(db).resetRoomState(roomId);

		const { rows } = await pool.query(
			`select state, state_blob, quarantined_blob, state_version from rooms where id = $1`,
			[roomId]
		);
		expect(rows[0].state).to.equal(null);
		expect(rows[0].state_blob).to.equal(null);
		expect(rows[0].quarantined_blob).to.equal('the-only-copy');
		expect(Number(rows[0].state_version)).to.be.greaterThan(0);
	});
});
