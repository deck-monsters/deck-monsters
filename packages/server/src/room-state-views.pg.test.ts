import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getLevel, type SerializedGame } from '@deck-monsters/engine';
import { expect } from 'chai';
import pg from 'pg';

import { createLogger } from './logger.js';
import { runMigrations } from './migrate.js';
import { buildSerializedGame } from './room-state-views.test-helpers.js';

// Real-Postgres check of the roadmap 37 task 7 views. Skipped unless TEST_DATABASE_URL is set.
// Like migrate.pg.test.ts it builds a FRESH database from the repo's migrations, so it also
// proves the view migration applies on top of the real schema and leaves the shared dev
// database untouched.
const url = process.env['TEST_DATABASE_URL'];
const suite = url ? describe : describe.skip;

const repoMigrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../supabase/migrations');
const quiet = createLogger('room-state-views-test');

const SUPABASE_STUBS = `
	do $$ begin
		if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
		if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
		if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
	exception when duplicate_object then null; end $$;
	create schema auth;
	create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
	create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
	create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;
`;

suite('room_state_* views against Postgres', () => {
	let admin: pg.Pool;
	let pool: pg.Pool;
	let dbName: string;
	const ownerId = randomUUID();
	const roomA = randomUUID();
	const roomB = randomUUID();
	const roomEmpty = randomUUID();
	const alice = randomUUID();
	const bob = randomUUID();
	// The engine mints each character's starting deck on load, so the expected deck size is read
	// back from the serialized state rather than seeded.
	let stateA: SerializedGame;
	let stateB: SerializedGame;
	const deckLength = (s: SerializedGame, userId: string): number =>
		((s.options['characters'] as Record<string, { options: { deck?: unknown[] } }>)[userId]!.options.deck ?? []).length;

	function urlFor(db: string): string {
		const u = new URL(url!);
		u.pathname = `/${db}`;
		return u.toString();
	}

	before(async () => {
		admin = new pg.Pool({ connectionString: url });
		dbName = `dm_views_test_${randomBytes(6).toString('hex')}`;
		await admin.query(`create database ${dbName}`);
		const dbUrl = urlFor(dbName);
		const setup = new pg.Pool({ connectionString: dbUrl });
		await setup.query(SUPABASE_STUBS);
		await setup.end();
		const report = await runMigrations({ connectionString: dbUrl, dir: repoMigrations, log: quiet });
		expect(report.ok).to.equal(true);

		pool = new pg.Pool({ connectionString: dbUrl });
		await pool.query(`insert into auth.users (id) values ($1)`, [ownerId]);
		await pool.query(`insert into profiles (id, display_name) values ($1, 'views-test') on conflict (id) do nothing`, [ownerId]);
		for (const [id, name] of [[roomA, 'a'], [roomB, 'b'], [roomEmpty, 'empty']] as const) {
			await pool.query(`insert into rooms (id, name, owner_id, invite_code) values ($1, $2, $3, $4)`, [
				id,
				name,
				ownerId,
				id.slice(0, 8),
			]);
		}

		stateA = await buildSerializedGame(roomA, [
			{
				userId: alice,
				type: 'Beastmaster',
				name: 'Alice',
				xp: 100,
				coins: 42,
				monsters: [
					{ type: 'Dragon', name: 'Smaug', xp: 60, cards: ['EnchantedFaceswapCard', 'HitCard'] },
					{ type: 'Dragon', name: 'Puff', xp: 0, cards: ['HitCard'] },
					{ type: 'Gladiator', name: 'Fang', xp: 1050, cards: ['EnchantedFaceswapCard'] },
				],
			},
			{ userId: bob, type: 'Beastmaster', name: 'Bob', monsters: [] },
		]);
		stateB = await buildSerializedGame(roomB, [
			{
				userId: bob,
				type: 'Beastmaster',
				name: 'Bob',
				coins: 7,
				monsters: [{ type: 'Dragon', name: 'Ember', xp: 5000, cards: ['HitCard', 'DelayedHit'] }],
			},
		]);
		await pool.query(`update rooms set state = $2::jsonb where id = $1`, [roomA, JSON.stringify(stateA)]);
		await pool.query(`update rooms set state = $2::jsonb where id = $1`, [roomB, JSON.stringify(stateB)]);
		// roomEmpty keeps state = null: a room that was never saved must contribute no rows.
	});

	after(async () => {
		await pool?.end();
		await admin.query(`drop database if exists ${dbName} with (force)`);
		await admin.end();
	});

	it('room_state_monsters lists every monster with owner, ids, xp and the engine level', async () => {
		const res = await pool.query(
			`select room_id, owner_user_id, monster_index, monster_type, stable_id, given_name, xp, level
			   from room_state_monsters order by given_name`
		);
		expect(res.rows.map((r) => [r.given_name, r.monster_type, r.room_id, r.owner_user_id, Number(r.xp)])).to.deep.equal([
			['Ember', 'Dragon', roomB, bob, 5000],
			['Fang', 'Gladiator', roomA, alice, 1050],
			['Puff', 'Dragon', roomA, alice, 0],
			['Smaug', 'Dragon', roomA, alice, 60],
		]);
		res.rows.forEach((r) => {
			expect(r.stable_id, r.given_name).to.be.a('string').with.length.greaterThan(0);
			expect(r.level, r.given_name).to.equal(getLevel(Number(r.xp)));
		});
		expect(res.rows.find((r) => r.given_name === 'Fang').level).to.equal(7);
		expect(res.rows.map((r) => r.monster_index).sort()).to.deep.equal([0, 0, 1, 2]);
	});

	it('room_state_level_for_xp agrees with the engine at and around every threshold', async () => {
		const xps = new Set<number>([0, 1, 27, 28]);
		for (let l = 1; l <= 40; l += 1) {
			// Find each threshold from the engine itself, by bisection on getLevel.
			let lo = 0;
			let hi = 1e10;
			while (lo < hi) {
				const mid = Math.floor((lo + hi) / 2);
				if (getLevel(mid) >= l) hi = mid;
				else lo = mid + 1;
			}
			[lo - 1, lo, lo + 1].forEach((x) => xps.add(x));
		}
		const list = [...xps].filter((x) => x >= 0);
		const res = await pool.query(
			`select x, public.room_state_level_for_xp(x) as level from unnest($1::numeric[]) as x`,
			[list]
		);
		expect(res.rows).to.have.length(list.length);
		res.rows.forEach((r) => expect(r.level, `xp ${r.x}`).to.equal(getLevel(Number(r.x))));
	});

	it('room_state_monster_cards has one row per card with its display name', async () => {
		const res = await pool.query(
			`select room_id, owner_user_id, monster_index, card, card_type from room_state_monster_cards
			  order by room_id, monster_index, card`
		);
		const rows = res.rows.map((r) => [r.room_id === roomA ? 'A' : 'B', r.monster_index, r.card, r.card_type]);
		expect(rows).to.have.deep.members([
			['A', 0, 'EnchantedFaceswapCard', 'Enchanted Faceswap'],
			['A', 0, 'HitCard', 'Hit'],
			['A', 1, 'HitCard', 'Hit'],
			['A', 2, 'EnchantedFaceswapCard', 'Enchanted Faceswap'],
			['B', 0, 'HitCard', 'Hit'],
			['B', 0, 'DelayedHit', 'Delayed Hit'],
		]);
		expect(rows).to.have.length(6);
	});

	it('room_state_characters returns coins, xp and deck size per user, defaults as zero', async () => {
		const res = await pool.query(
			`select room_id, user_id, coins, xp, deck_size from room_state_characters order by room_id, user_id`
		);
		const byKey = new Map(res.rows.map((r) => [`${r.room_id === roomA ? 'A' : 'B'}:${r.user_id}`, r]));
		expect(res.rows).to.have.length(3);
		const a = byKey.get(`A:${alice}`);
		expect([Number(a.coins), Number(a.xp)]).to.deep.equal([42, 100]);
		expect(deckLength(stateA, alice)).to.be.greaterThan(0);
		expect(a.deck_size).to.equal(deckLength(stateA, alice));
		expect(byKey.get(`B:${bob}`).deck_size).to.equal(deckLength(stateB, bob));
		const bobA = byKey.get(`A:${bob}`);
		expect(Number(bobA.xp)).to.equal(0);
		expect(Number(byKey.get(`B:${bob}`).coins)).to.equal(7);
	});

	it('answers the roadmap Faceswap query with the Dragon that owns the card', async () => {
		const res = await pool.query(
			`select m.room_id, m.given_name, m.level
			   from room_state_monsters m
			   join room_state_monster_cards c using (room_id, stable_id)
			  where m.monster_type = 'Dragon' and c.card_type = 'Enchanted Faceswap'`
		);
		expect(res.rows).to.have.length(1);
		expect(res.rows[0]).to.include({ room_id: roomA, given_name: 'Smaug', level: getLevel(60) });
	});

	it('is not exposed to the API roles', async () => {
		const objects = ['card_types', 'room_state_monsters', 'room_state_monster_cards', 'room_state_characters'];
		for (const role of ['anon', 'authenticated']) {
			for (const obj of objects) {
				const r = await pool.query(`select has_table_privilege($1, $2, 'select') as ok`, [role, `public.${obj}`]);
				expect(r.rows[0].ok, `${role} on ${obj}`).to.equal(false);
			}
			const f = await pool.query(
				`select has_function_privilege($1, 'public.room_state_level_for_xp(numeric)', 'execute') as ok`,
				[role]
			);
			expect(f.rows[0].ok, `${role} on level function`).to.equal(false);
		}
		const rls = await pool.query(`select relrowsecurity from pg_class where oid = 'public.card_types'::regclass`);
		expect(rls.rows[0].relrowsecurity).to.equal(true);
		const opts = await pool.query(
			`select relname, reloptions from pg_class where relname like 'room_state_%' and relkind = 'v'`
		);
		expect(opts.rows).to.have.length(3);
		opts.rows.forEach((r) => expect(r.reloptions, r.relname).to.include('security_invoker=true'));
	});
});
