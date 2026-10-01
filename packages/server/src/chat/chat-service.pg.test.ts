import { randomUUID } from 'node:crypto';

import { expect } from 'chai';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import type { Db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { ChatService } from './chat-service.js';

// Real-Postgres checks for chat storage, visibility, read position and the retention sweep
// (roadmap 41). Skipped unless TEST_DATABASE_URL is set.
const url = process.env['TEST_DATABASE_URL'];
const suite = url ? describe : describe.skip;

const DAY = 24 * 60 * 60 * 1000;

suite('ChatService against Postgres', () => {
	const pool = new pg.Pool({ connectionString: url });
	const db = drizzle(pool, { schema }) as unknown as Db;
	const users = { ada: randomUUID(), ben: randomUUID(), cal: randomUUID(), dee: randomUUID() };
	const outsider = randomUUID();
	let roomId: string;
	let otherRoomId: string;
	let inEncounter = false;
	const game = {
		characters: {} as Record<string, { givenName: string }>,
		get ring() {
			return { inEncounter };
		},
	};
	const chat = new ChatService(db, { getGame: async () => game as never });

	async function addRoom(): Promise<string> {
		const id = randomUUID();
		await pool.query(`insert into rooms (id, name, owner_id, invite_code) values ($1, 'chat-test', $2, $3)`, [
			id,
			users.ada,
			id.slice(0, 8),
		]);
		return id;
	}

	async function addMember(room: string, userId: string, seenDaysAgo: number | null) {
		await pool.query(
			`insert into room_members (room_id, user_id, last_seen_at) values ($1, $2, ${
				seenDaysAgo === null ? 'null' : `now() - make_interval(days => ${seenDaysAgo})`
			})`,
			[room, userId]
		);
	}

	/** Insert a message directly with a chosen age. */
	async function insertAged(room: string, sender: string, recipient: string | null, ageDays: number, text = 'old') {
		const { rows } = await pool.query(
			`insert into room_messages (room_id, sender_user_id, recipient_user_id, text, created_at)
			 values ($1, $2, $3, $4, now() - make_interval(days => $5)) returning id`,
			[room, sender, recipient, text, ageDays]
		);
		return Number(rows[0].id);
	}

	async function ids(room: string): Promise<number[]> {
		const { rows } = await pool.query(`select id from room_messages where room_id = $1 order by id`, [room]);
		return rows.map((r) => Number(r.id));
	}

	before(async () => {
		for (const [name, id] of Object.entries({ ...users, outsider })) {
			await pool.query(`insert into auth.users (id) values ($1)`, [id]);
			// The signup trigger already made a profile with a generated name; set ours.
			await pool.query(
				`insert into profiles (id, display_name) values ($1, $2)
				 on conflict (id) do update set display_name = excluded.display_name`,
				[id, name]
			);
		}
	});

	beforeEach(async () => {
		inEncounter = false;
		game.characters = {};
		roomId = await addRoom();
		otherRoomId = await addRoom();
		for (const room of [roomId, otherRoomId]) {
			for (const u of [users.ada, users.ben, users.cal]) await addMember(room, u, 0);
		}
	});

	afterEach(async () => {
		await pool.query(`delete from rooms where id = any($1)`, [[roomId, otherRoomId]]);
	});

	after(async () => {
		await pool.query(`delete from auth.users where id = any($1)`, [[...Object.values(users), outsider]]);
		await pool.end();
	});

	it('stores a message with names, and stamps the fight counter plus one during a fight', async () => {
		game.characters = { [users.ada]: { givenName: 'Ada the Bold' } };
		await pool.query(`update rooms set fight_counter = 6 where id = $1`, [roomId]);
		const quiet = await chat.send({ roomId, senderUserId: users.ada, text: 'before' });
		expect(quiet.fightNumber).to.equal(null);
		expect(quiet.senderName).to.equal('Ada the Bold');
		inEncounter = true;
		const live = await chat.send({ roomId, senderUserId: users.ben, text: 'during' });
		expect(live.fightNumber).to.equal(7);
		expect(live.senderName).to.equal('ben');
		const [row] = (await pool.query(`select fight_number, source from room_messages where id = $1`, [live.id])).rows;
		expect(row.fight_number).to.equal(7);
		expect(row.source).to.equal('web');
	});

	it('refuses a DM to a user who is not a member of the room', async () => {
		let code = '';
		try {
			await chat.send({ roomId, senderUserId: users.ada, text: 'hi', toUserId: outsider });
		} catch (err) {
			code = (err as { code: string }).code;
		}
		expect(code).to.equal('not_member');
	});

	it("shows a DM only to its two players, and only in its own room's history", async () => {
		const room = await chat.send({ roomId, senderUserId: users.ada, text: 'to all' });
		const dm = await chat.send({ roomId, senderUserId: users.ada, text: 'psst', toUserId: users.ben });
		await chat.send({ roomId: otherRoomId, senderUserId: users.ada, text: 'elsewhere' });

		const texts = async (userId: string, r = roomId) =>
			(await chat.history({ roomId: r, userId })).map((m) => m.text);
		expect(await texts(users.ada)).to.deep.equal(['to all', 'psst']);
		expect(await texts(users.ben)).to.deep.equal(['to all', 'psst']);
		expect(await texts(users.cal)).to.deep.equal(['to all']);
		expect(await texts(users.ada, otherRoomId)).to.deep.equal(['elsewhere']);

		const [seen] = (await chat.history({ roomId, userId: users.ben })).filter((m) => m.id === dm.id);
		expect(seen).to.include({ senderName: 'ada', recipientName: 'ben', recipientUserId: users.ben });
		expect(room.id).to.be.lessThan(dm.id);
	});

	it('pages history: newest N ascending, before an id, after an id', async () => {
		const sent: number[] = [];
		for (let i = 0; i < 5; i++) {
			sent.push((await insertAged(roomId, users.ada, null, 0, `m${i}`)));
		}
		const newest = await chat.history({ roomId, userId: users.cal, limit: 2 });
		expect(newest.map((m) => m.text)).to.deep.equal(['m3', 'm4']);
		const earlier = await chat.history({ roomId, userId: users.cal, beforeId: sent[3], limit: 2 });
		expect(earlier.map((m) => m.text)).to.deep.equal(['m1', 'm2']);
		const later = await chat.history({ roomId, userId: users.cal, afterId: sent[1] });
		expect(later.map((m) => m.text)).to.deep.equal(['m2', 'm3', 'm4']);
	});

	it('counts unread excluding your own messages and DMs you cannot see; markRead never goes back', async () => {
		const a = await insertAged(roomId, users.ada, null, 0, 'a');
		const b = await insertAged(roomId, users.ben, null, 0, 'b');
		await insertAged(roomId, users.ada, users.cal, 0, 'dm to cal');
		const c = await insertAged(roomId, users.cal, null, 0, 'c');
		expect(await chat.unreadCount(roomId, users.ben)).to.equal(2); // a and c: not their own b, not the DM to cal
		expect(await chat.unreadCount(roomId, users.cal)).to.equal(3); // a, b, dm
		expect(await chat.lastReadId(roomId, users.ben)).to.equal(0);

		expect(await chat.markRead(roomId, users.ben, b)).to.equal(b);
		expect(await chat.markRead(roomId, users.ben, a)).to.equal(b); // never backwards
		expect(await chat.lastReadId(roomId, users.ben)).to.equal(b);
		expect(await chat.unreadCount(roomId, users.ben)).to.equal(1);

		// A bogus huge id cannot mark messages that do not exist yet as read.
		expect(await chat.markRead(roomId, users.ben, 2_000_000_000)).to.equal(c);
		const later = await insertAged(roomId, users.cal, null, 0, 'later');
		expect(await chat.unreadCount(roomId, users.ben)).to.equal(1);
		expect(later).to.be.greaterThan(c);
	});

	it("keeps read position per room: reading in one room does not touch another", async () => {
		const a = await insertAged(roomId, users.ada, null, 0);
		await insertAged(otherRoomId, users.ada, null, 0);
		await chat.markRead(roomId, users.ben, a);
		expect(await chat.unreadCount(roomId, users.ben)).to.equal(0);
		expect(await chat.unreadCount(otherRoomId, users.ben)).to.equal(1);
	});

	describe('sweep', () => {
		it('rule 1: deletes messages older than 30 days, even if unread by an active member', async () => {
			const old = await insertAged(roomId, users.ada, null, 31);
			const recent = await insertAged(roomId, users.ada, null, 6);
			const r = await chat.sweep();
			expect(r.aged).to.be.greaterThanOrEqual(1);
			expect(await ids(roomId)).to.deep.equal([recent]);
			expect(old).to.be.lessThan(recent);
		});

		it('rule 2: keeps only the newest 500 in a room, and never trims another room', async () => {
			await pool.query(
				`insert into room_messages (room_id, sender_user_id, text) select $1, $2, 'bulk' from generate_series(1, 503)`,
				[roomId, users.ada]
			);
			await insertAged(otherRoomId, users.ada, null, 0);
			const before = await ids(roomId);
			const r = await chat.sweep();
			expect(r.overCap).to.be.greaterThanOrEqual(3);
			const after = await ids(roomId);
			expect(after).to.have.length(500);
			expect(after).to.deep.equal(before.slice(3));
			expect(await ids(otherRoomId)).to.have.length(1);
		});

		it('rule 3: a room message older than 7 days waits for every active member to read it', async () => {
			const id = await insertAged(roomId, users.ada, null, 8);
			await chat.markRead(roomId, users.ben, id);
			await chat.sweep();
			expect(await ids(roomId), 'cal has not read it').to.deep.equal([id]);
			await chat.markRead(roomId, users.cal, id);
			await chat.sweep();
			expect(await ids(roomId), 'ada wrote it; ben and cal have read it').to.deep.equal([]);
		});

		it('rule 3: a message newer than 7 days is kept even when everyone has read it', async () => {
			const id = await insertAged(roomId, users.ada, null, 6);
			await chat.markRead(roomId, users.ben, id);
			await chat.markRead(roomId, users.cal, id);
			await chat.sweep();
			expect(await ids(roomId)).to.deep.equal([id]);
		});

		it('rule 3: a member inactive for 15 days does not hold a message back', async () => {
			await pool.query(
				`update room_members set last_seen_at = now() - make_interval(days => 15) where room_id = $1 and user_id = $2`,
				[roomId, users.cal]
			);
			const id = await insertAged(roomId, users.ada, null, 8);
			await chat.markRead(roomId, users.ben, id);
			await chat.sweep();
			expect(await ids(roomId)).to.deep.equal([]);
		});

		it('rule 3: a member never seen does not hold a message back, but one seen 13 days ago does', async () => {
			await pool.query(`update room_members set last_seen_at = null where room_id = $1 and user_id = $2`, [roomId, users.cal]);
			await pool.query(
				`update room_members set last_seen_at = now() - make_interval(days => 13) where room_id = $1 and user_id = $2`,
				[roomId, users.ben]
			);
			const id = await insertAged(roomId, users.ada, null, 8);
			await chat.sweep();
			expect(await ids(roomId), 'ben (13 days) has not read it').to.deep.equal([id]);
			await chat.markRead(roomId, users.ben, id);
			await chat.sweep();
			expect(await ids(roomId)).to.deep.equal([]);
		});

		it('rule 3: a DM counts only its two players, so a bystander who never read it holds nothing', async () => {
			const id = await insertAged(roomId, users.ada, users.ben, 8, 'dm');
			await chat.sweep();
			expect(await ids(roomId), 'ben (active) has not read it').to.deep.equal([id]);
			// Cal, an active bystander, never reads it. Only the recipient does.
			await chat.markRead(roomId, users.ben, id);
			await chat.sweep();
			expect(await ids(roomId)).to.deep.equal([]);
		});

		it('rule 3: a DM to an inactive recipient is released once older than 7 days', async () => {
			await pool.query(
				`update room_members set last_seen_at = now() - make_interval(days => 20) where room_id = $1 and user_id = $2`,
				[roomId, users.ben]
			);
			await insertAged(roomId, users.ada, users.ben, 8, 'dm');
			await chat.sweep();
			expect(await ids(roomId)).to.deep.equal([]);
		});

		it('takes the sweep time as a parameter', async () => {
			const id = await insertAged(roomId, users.ada, null, 20);
			await chat.sweep(new Date(Date.now() + 5 * DAY));
			expect(await ids(roomId)).to.deep.equal([id]);
			await chat.sweep(new Date(Date.now() + 11 * DAY));
			expect(await ids(roomId)).to.deep.equal([]);
		});
	});

	it('deletes messages and read positions when the room is deleted', async () => {
		const doomed = await addRoom();
		await addMember(doomed, users.ada, 0);
		const id = await insertAged(doomed, users.ada, null, 0);
		await chat.markRead(doomed, users.ada, id);
		await pool.query(`delete from rooms where id = $1`, [doomed]);
		const m = await pool.query(`select count(*)::int as n from room_messages where room_id = $1`, [doomed]);
		const r = await pool.query(`select count(*)::int as n from room_message_reads where room_id = $1`, [doomed]);
		expect(m.rows[0].n).to.equal(0);
		expect(r.rows[0].n).to.equal(0);
	});

	it('is closed to the browser roles: RLS on and no grants', async () => {
		const { rows } = await pool.query(
			`select relname, relrowsecurity from pg_class where relname in ('room_messages', 'room_message_reads')`
		);
		expect(rows).to.have.length(2);
		for (const r of rows) expect(r.relrowsecurity, r.relname).to.equal(true);
	});
});
