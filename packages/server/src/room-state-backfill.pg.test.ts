import { randomUUID } from 'node:crypto';
import zlib from 'node:zlib';

import { expect } from 'chai';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import type { Db } from './db/index.js';
import * as schema from './db/schema.js';
import { backfillRoomState, decodeStateBlob, FROM_BLOB_REMOVED, parseBackfillArgs } from './room-state-backfill.js';
import { nextStateVersion, PostgresStateStore } from './state-store.js';

// Real-Postgres check for roadmap 37 task 5 (same gating and setup as state-store.pg.test.ts).
// Every call is scoped with `roomId` so rows other tests leave behind are never touched.
const url = process.env['TEST_DATABASE_URL'];
const suite = url ? describe : describe.skip;

const gz = (obj: unknown) => zlib.gzipSync(JSON.stringify(obj)).toString('base64');
const game = (marker: string, extra: Record<string, unknown> = {}) => ({
	name: 'Game',
	options: { marker, characters: { u1: { name: 'C', options: { xp: 5 } } }, ...extra },
});

describe('decodeStateBlob', () => {
	it('falls through to gzip for a digit-only string, and rejects non-objects', () => {
		expect(() => decodeStateBlob('12345678')).to.throw();
		expect(() => decodeStateBlob('[1,2]')).to.throw();
		expect(() => decodeStateBlob('null')).to.throw();
	});

	it('returns an old-format object as saved', () => {
		const old = { characters: { a: 1 } };
		expect(decodeStateBlob(JSON.stringify(old))).to.deep.equal(old);
		expect(decodeStateBlob(gz(old))).to.deep.equal(old);
	});
});

describe('parseBackfillArgs', () => {
	it('accepts the known flags', () => {
		expect(parseBackfillArgs(['--dry-run', '--room', 'r1'])).to.deep.equal({ dryRun: true, roomId: 'r1' });
		// Removed in release 2: blobs are stale, so a rollback roll-forward would lose data.
		expect(parseBackfillArgs(['--from-blob'])).to.deep.equal({ error: FROM_BLOB_REMOVED });
		expect(parseBackfillArgs(['--i-stopped-the-service'])).to.deep.equal({ error: FROM_BLOB_REMOVED });
	});

	it('rejects typos and a missing room id', () => {
		for (const bad of [['--dryrun'], ['--dry_run'], ['--room'], ['--room', '--dry-run'], ['stray']]) {
			expect(parseBackfillArgs(bad)).to.have.property('error');
		}
	});
});

suite('room state backfill against Postgres', () => {
	const pool = new pg.Pool({ connectionString: url });
	const db = drizzle(pool, { schema }) as unknown as Db;
	const store = new PostgresStateStore(db);
	const userId = randomUUID();
	const created: string[] = [];

	async function makeRoom(blob: string | null, state: unknown = null, version = 0): Promise<string> {
		const id = randomUUID();
		created.push(id);
		await pool.query(
			`insert into rooms (id, name, owner_id, invite_code, state_blob, state, state_version)
			 values ($1, 'pg-backfill', $2, $3, $4, $5::jsonb, $6)`,
			[id, userId, id.slice(0, 8), blob, state === null ? null : JSON.stringify(state), version]
		);
		return id;
	}

	async function row(id: string) {
		const res = await pool.query(
			`select jsonb_typeof(state) as type, state, state_version, state_blob from rooms where id = $1`,
			[id]
		);
		return res.rows[0];
	}

	before(async () => {
		await pool.query(`insert into auth.users (id) values ($1)`, [userId]);
		await pool.query(`insert into profiles (id, display_name) values ($1, 'pg-backfill') on conflict (id) do nothing`, [userId]);
	});

	after(async () => {
		await pool.query(`delete from rooms where id = any($1)`, [created]);
		await pool.query(`delete from auth.users where id = $1`, [userId]);
		await pool.end();
	});

	it('converts a legacy gzip blob to a jsonb object and leaves state_version alone', async () => {
		const decoded = game('gzip');
		const id = await makeRoom(gz(decoded), null, 7);
		const report = await backfillRoomState(db, { roomId: id });

		expect(report.converted).to.equal(1);
		expect(report.failed).to.deep.equal([]);
		expect(report.bytes).to.equal(Buffer.byteLength(JSON.stringify(decoded)));
		const r = await row(id);
		expect(r.type).to.equal('object');
		expect(r.state).to.deep.equal(decoded);
		expect(Number(r.state_version)).to.equal(7);
	});

	it('converts a plain JSON string blob', async () => {
		const decoded = game('plain');
		const id = await makeRoom(JSON.stringify(decoded));
		const report = await backfillRoomState(db, { roomId: id });
		expect(report.converted).to.equal(1);
		expect((await row(id)).state).to.deep.equal(decoded);
	});

	it('reports a corrupt blob and leaves the row unchanged', async () => {
		const id = await makeRoom('not-json-and-not-gzip!!');
		const report = await backfillRoomState(db, { roomId: id });
		expect(report.converted).to.equal(0);
		expect(report.failed).to.have.length(1);
		expect(report.failed[0]!.roomId).to.equal(id);
		const r = await row(id);
		expect(r.state).to.equal(null);
		expect(r.state_blob).to.equal('not-json-and-not-gzip!!');
	});

	it('repairs a NUL in a key and in a value', async () => {
		const id = await makeRoom(gz(game('nul', { presets: { 'a\u0000b': { note: 'x\u0000y' } } })));
		const report = await backfillRoomState(db, { roomId: id });
		expect(report.converted).to.equal(1);
		const r = await row(id);
		expect(r.state.options.presets).to.deep.equal({ 'a�b': { note: 'x�y' } });
	});

	it('is idempotent: a second run converts nothing', async () => {
		const id = await makeRoom(gz(game('twice')));
		expect((await backfillRoomState(db, { roomId: id })).converted).to.equal(1);
		const second = await backfillRoomState(db, { roomId: id });
		expect(second.converted).to.equal(0);
		expect(second.failed).to.deep.equal([]);
	});

	it('a dry run writes nothing but counts', async () => {
		const id = await makeRoom(gz(game('dry')));
		const report = await backfillRoomState(db, { roomId: id, dryRun: true });
		expect(report.converted).to.equal(1);
		expect(report.bytes).to.be.greaterThan(0);
		expect((await row(id)).state).to.equal(null);
	});

	it('does not disturb a room already loaded in release 1', async () => {
		const id = await makeRoom(gz(game('legacy')), null, 0);
		await backfillRoomState(db, { roomId: id });
		const before = Number((await row(id)).state_version);

		// The live store saves after the backfill: its version is newer, so it lands.
		await store.save(id, game('live'));
		const r = await row(id);
		expect(r.state.options.marker).to.equal('live');
		expect(Number(r.state_version)).to.be.greaterThan(before);

		// A room the store already saved has `state` set, so the backfill never selects it.
		const report = await backfillRoomState(db, { roomId: id });
		expect(report.converted).to.equal(0);
		expect((await row(id)).state.options.marker).to.equal('live');
	});

	it('counts a room the server saved between read and write as already converted', async () => {
		const id = await makeRoom(gz(game('old')));
		const report = await backfillRoomState(db, {
			roomId: id,
			beforeWrite: () => store.save(id, game('server')),
		});
		expect(report.converted).to.equal(0);
		expect(report.alreadyConverted).to.equal(1);
		expect((await row(id)).state.options.marker).to.equal('server');
	});

	it('does not write an old decode over a blob that changed, and retries with the new one', async () => {
		const id = await makeRoom(gz(game('old')));
		let calls = 0;
		const report = await backfillRoomState(db, {
			roomId: id,
			beforeWrite: async () => {
				calls += 1;
				if (calls === 1) await pool.query(`update rooms set state_blob = $2 where id = $1`, [id, gz(game('new'))]);
			},
		});
		expect(report.converted).to.equal(1);
		expect(report.skippedChanged).to.deep.equal([]);
		expect((await row(id)).state.options.marker).to.equal('new');
	});

	it('reports a room whose blob keeps changing as skippedChanged', async () => {
		const id = await makeRoom(gz(game('v0')));
		let n = 0;
		const report = await backfillRoomState(db, {
			roomId: id,
			beforeWrite: async () => {
				n += 1;
				await pool.query(`update rooms set state_blob = $2 where id = $1`, [id, gz(game(`v${n}`))]);
			},
		});
		expect(report.converted).to.equal(0);
		expect(report.skippedChanged).to.deep.equal([id]);
		expect((await row(id)).state).to.equal(null);
	});

	it('a failed write reports a short reason with no player data', async () => {
		// Drizzle wraps a failed query as "Failed query: <sql>\nparams: <params>", and the params
		// are the whole state. Throw that shape from the write step and check none of it leaks.
		const id = await makeRoom('{"name":"Game","options":{"marker":"SECRET-MARKER"}}');
		const report = await backfillRoomState(db, {
			roomId: id,
			beforeWrite: () => {
				throw Object.assign(
					new Error('Failed query: update "rooms" set "state" = $1\nparams: {"marker":"SECRET-MARKER"}'),
					{ cause: new Error('connection terminated\nparams: SECRET-MARKER') }
				);
			},
		});
		expect(report.converted).to.equal(0);
		expect(report.failed).to.have.length(1);
		const reason = report.failed[0]!.reason;
		expect(reason).to.equal('connection terminated');
		expect(JSON.stringify(report)).to.not.contain('SECRET-MARKER');
	});

	it('repairs a lone surrogate, which jsonb would reject, and converts the room', async () => {
		const id = await makeRoom('{"name":"Game","options":{"marker":"cut","bad":"x\\ud800y"}}');
		const report = await backfillRoomState(db, { roomId: id });
		expect(report.failed).to.have.length(0);
		expect(report.converted).to.equal(1);
		expect((await row(id)).state.options.bad).to.equal('x\uFFFDy');
	});

	it('a decode failure reports fixed text', async () => {
		const id = await makeRoom('{"marker":"SECRET-MARKER" oops');
		const report = await backfillRoomState(db, { roomId: id });
		expect(report.failed[0]!.reason).to.equal('could not decode blob (not JSON, not gzip)');
	});
});
