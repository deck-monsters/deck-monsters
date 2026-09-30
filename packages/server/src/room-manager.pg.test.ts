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

// Bug G: two RoomManagers (the server and the Discord connector) over one database. A reset in
// one must reach the other's loaded copy; before state_generation the other copy's next save
// was stamped after the tombstone, landed, and brought the old room back.
suite('RoomManager reset across two processes against Postgres', () => {
	const pool = new pg.Pool({ connectionString: url });
	const db = drizzle(pool, { schema }) as unknown as Db;
	const userId = randomUUID();
	const roomId = randomUUID();
	const marker = (m: string) => ({ name: 'Game', options: { roomId, marker: m } });
	let a: RoomManager;
	let b: RoomManager;

	const rowOf = async () =>
		(await pool.query(`select state, state_generation from rooms where id = $1`, [roomId])).rows[0];
	const isActive = (m: RoomManager) => (m as unknown as { active: Map<string, unknown> }).active.has(roomId);
	const saveVia = async (m: RoomManager, mark: string) => {
		const game = await m.getGame(roomId);
		game.setOptions({ marker: mark } as never);
		return game.flushState();
	};

	beforeEach(async () => {
		await pool.query(`insert into auth.users (id) values ($1) on conflict do nothing`, [userId]);
		await pool.query(`insert into profiles (id, display_name) values ($1, 'pg-test') on conflict (id) do nothing`, [userId]);
		await pool.query(
			`insert into rooms (id, name, owner_id, invite_code, state) values ($1, 'pg-test', $2, $3, $4)`,
			[roomId, userId, roomId.slice(0, 8), JSON.stringify(marker('before'))]
		);
		a = new RoomManager(db);
		b = new RoomManager(db);
		await a.getGame(roomId);
		await b.getGame(roomId);
	});

	afterEach(async () => {
		for (const m of [a, b]) await m.unloadRoom(roomId).catch(() => undefined);
		await pool.query(`delete from rooms where id = $1`, [roomId]);
	});

	after(async () => {
		await pool.query(`delete from auth.users where id = $1`, [userId]);
		await pool.end();
	});

	it("refuses the other process's save after a reset, drops its copy, and reloads the reset room", async () => {
		await a.resetRoomState(roomId);
		const reset = await rowOf();
		expect(reset.state).to.equal(null);
		expect(Number(reset.state_generation)).to.equal(1);

		await saveVia(b, 'stale-from-b'); // stamped after the tombstone: only the generation refuses it
		await new Promise((r) => setTimeout(r, 50)); // the probe and drop run after the refused write

		const after = await rowOf();
		expect(after.state, 'the old room must not come back').to.equal(null);
		expect(isActive(b), 'B dropped its copy').to.equal(false);

		await b.getGame(roomId); // reloads the reset room: no state, generation 1
		expect(isActive(b)).to.equal(true);
		await saveVia(b, 'fresh-from-b');
		expect((await rowOf()).state.options.marker).to.equal('fresh-from-b');
	});

	it('lets the resetting process save normally afterwards', async () => {
		await a.resetRoomState(roomId);
		await saveVia(a, 'after-reset');
		const r = await rowOf();
		expect(r.state.options.marker).to.equal('after-reset');
		expect(Number(r.state_generation)).to.equal(1);
		expect(isActive(a)).to.equal(true);
	});

	it('keeps the generation across a restart (a new manager loads and saves at it)', async () => {
		await a.resetRoomState(roomId);
		await b.unloadRoom(roomId).catch(() => undefined);
		const restarted = new RoomManager(db);
		await saveVia(restarted, 'after-restart');
		expect((await rowOf()).state.options.marker).to.equal('after-restart');
		await restarted.unloadRoom(roomId);
	});

	it('counts an ordinary stale save without dropping the copy', async () => {
		await pool.query(`update rooms set state_version = state_version + 9000000000000000 where id = $1`, [roomId]);
		await saveVia(b, 'older');
		await new Promise((r) => setTimeout(r, 50));
		expect(isActive(b)).to.equal(true);
	});
});
