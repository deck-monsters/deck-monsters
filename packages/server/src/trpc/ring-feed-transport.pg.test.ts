import { randomUUID } from 'node:crypto';

import type { GameEvent, RoomEventBus } from '@deck-monsters/engine';
import { expect } from 'chai';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import { ChatService } from '../chat/chat-service.js';
import type { Db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { ringFeedReplayFromDbTotal, ringFeedReplayGapTotal, wsConnectionsActive } from '../metrics/index.js';
import { RoomManager } from '../room-manager.js';
import {
	FaultProxy,
	FeedClient,
	installTestAuth,
	loadAppFeedConnection,
	nextMillisecond,
	poll,
	sleep,
	startRealServer,
	type RealServer,
} from '../shared/feed-transport-harness.js';

/*
 * Roadmap 52, D4: the ringFeed connection against the REAL server and the REAL tRPC WebSocket
 * client. The browser feed lab (docs/reference/feed-lab.md) replaces both; nothing else tests
 * the wire. What runs here:
 *
 *   - Fastify + tRPC `useWSS` on an ephemeral port, the real router, a real RoomManager and
 *     ChatService on a real Postgres, the server's own JWT check (a test key, see
 *     `installTestAuth`), real room and member rows.
 *   - `createWSClient` + `wsLink` from @trpc/client, built from the options the web app uses
 *     (apps/web/src/lib/ws-client-options.ts, imported, not copied) over Node's WebSocket.
 *   - A TCP proxy between them that can reset every connection, refuse new ones, or black-hole
 *     traffic without closing anything.
 *
 * Not covered: the React hook (`useRingFeed`) itself. Item 8 replays what it does at the
 * client level (unsubscribe, subscribe with a new input), and the pane dedupe by id.
 *
 * Skipped unless TEST_DATABASE_URL is set, like the other *.pg.test.ts suites; CI sets it.
 */
const url = process.env['TEST_DATABASE_URL'];
const suite = url ? describe : describe.skip;

type Timing = { label: string; ms: number };
const timings: Timing[] = [];
const note = (label: string, ms: number) => {
	timings.push({ label, ms });
	console.log(`      [timing] ${label}: ${ms} ms`);
};

suite('ringFeed over the real server and the real tRPC WebSocket client', function () {
	// The suite as a whole is bounded well under the 3 minute budget; individual tests
	// set their own limits (the idle soak and black hole need more than mocha's 10 s default).
	this.timeout(60_000);

	const pool = new pg.Pool({ connectionString: url });
	const db = drizzle(pool, { schema }) as unknown as Db;
	const userA = randomUUID();
	const userB = randomUUID();
	let roomManager: RoomManager;
	let chat: ChatService;
	let server: RealServer;
	let signToken: (userId: string) => Promise<string>;
	let restoreAuth: () => void;

	const rooms: string[] = [];
	let roomId: string;
	let bus: RoomEventBus;
	let proxy: FaultProxy;
	let client: FeedClient;

	before(async () => {
		for (const [id, name] of [[userA, 'feed-a'], [userB, 'feed-b']] as const) {
			await pool.query(`insert into auth.users (id) values ($1)`, [id]);
			await pool.query(`insert into profiles (id, display_name) values ($1, $2) on conflict (id) do nothing`, [id, name]);
		}
		roomManager = new RoomManager(db);
		chat = new ChatService(db, roomManager);
		const auth = await installTestAuth();
		signToken = auth.signToken;
		restoreAuth = auth.restore;
		server = await startRealServer(roomManager, chat);
	});

	after(async () => {
		await server?.close();
		restoreAuth?.();
		for (const id of rooms) {
			await roomManager.unloadRoom(id).catch(() => {});
			await pool.query(`delete from rooms where id = $1`, [id]);
		}
		await pool.query(`delete from auth.users where id = any($1)`, [[userA, userB]]);
		await pool.end();
		const total = timings.map((t) => `${t.label}=${t.ms}ms`).join('; ');
		console.log(`      [timing summary] ${total}`);
	});

	// A fresh room per test: its own event bus, buffer and rows, so tests cannot see each other.
	beforeEach(async () => {
		const created = await roomManager.createRoom(userA, 'feed-transport');
		roomId = created.roomId;
		rooms.push(roomId);
		await pool.query(`insert into room_members (room_id, user_id, role) values ($1, $2, 'member')`, [roomId, userB]);
		bus = await roomManager.getEventBus(roomId);
		proxy = new FaultProxy(server.port);
		await proxy.listen();
		const token = await signToken(userA);
		client = await FeedClient.create(() => `ws://127.0.0.1:${proxy.port}/trpc?token=${encodeURIComponent(token)}`);
	});

	afterEach(async () => {
		client.close();
		await proxy.close();
		await roomManager.unloadRoom(roomId).catch(() => {});
	});

	const publish = (n: number, extra: { scope?: 'public' | 'private'; targetUserId?: string } = {}): GameEvent =>
		bus.publish({ type: 'announce', scope: extra.scope ?? 'public', targetUserId: extra.targetUserId, text: `evt-${n}`, payload: {} });
	const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `evt-${from + i}`);
	const handshakes = () => client.frames.filter((f) => f.type === 'handshake');
	const heartbeats = () => client.frames.filter((f) => f.type === 'heartbeat');
	const gaps = () => client.frames.filter((f) => f.type === 'system.gap');
	const waitHandshakes = (n: number, ms = 20_000) => client.waitFor(() => handshakes().length >= n, ms, `${n} handshake(s)`);
	const waitTexts = (last: string, ms = 20_000) => client.waitFor(() => client.eventTexts().includes(last), ms, `${last} to arrive`);
	const persisted = async (count: number) =>
		poll(
			async () => {
				const { rows } = await pool.query(`select count(*)::int as n from room_events where room_id = $1 and type = 'announce'`, [roomId]);
				return rows[0].n >= count;
			},
			30_000,
			`${count} announce rows in room_events`
		);
	const gauge = async () => {
		const m = await wsConnectionsActive.get();
		return m.values.find((v) => v.labels['room_id'] === roomId)?.value ?? 0;
	};
	const counter = async (c: typeof ringFeedReplayFromDbTotal) => {
		const m = await c.get();
		return m.values.find((v) => v.labels['room_id'] === roomId)?.value ?? 0;
	};

	// -----------------------------------------------------------------------------------
	// 6. First subscribe, and the replay paths
	// -----------------------------------------------------------------------------------
	describe('first subscribe and replay (item 6)', () => {
		it('with no cursor: handshake first, then the recent events this player may see, in order', async () => {
			publish(1);
			publish(2);
			publish(3, { scope: 'private', targetUserId: userB });
			publish(4, { scope: 'private', targetUserId: userA });
			publish(5);

			client.subscribe({ roomId });
			await waitTexts('evt-5');

			expect(client.frames[0]!.type).to.equal('handshake');
			const hs = client.frames[0]!.payload as { yourUserId: string; protocolVersion: number; ringState: unknown };
			expect(hs.yourUserId).to.equal(userA);
			expect(hs.protocolVersion).to.be.a('number');
			expect(hs.ringState).to.be.an('object');
			// B's private line never reaches A; A's own does.
			expect(client.eventTexts()).to.deep.equal(['evt-1', 'evt-2', 'evt-4', 'evt-5']);
			expect(gaps()).to.have.length(0);
		});

		it('a cursor older than the in-memory buffer is replayed from Postgres, in order, with no gap', async () => {
			const stop = client.subscribe({ roomId });
			await waitHandshakes(1);
			const first = publish(1);
			await waitTexts('evt-1');
			stop();

			// 230 events push evt-1 out of the 200-event ring buffer; the room stays loaded.
			for (let n = 2; n <= 231; n++) publish(n);
			expect(bus.getEventsSince(first.id).truncated, 'the cursor must have left the buffer').to.equal(true);
			await persisted(231);

			const fromDbBefore = await counter(ringFeedReplayFromDbTotal);
			const gapsBefore = await counter(ringFeedReplayGapTotal);
			client.subscribe({ roomId, lastEventId: first.id });
			await waitTexts('evt-231');

			// evt-1 was delivered by the first subscription; the replay is evt-2..evt-231 exactly.
			const replayed = client.frames.filter((f) => f.sub === 2 && f.type === 'announce').map((f) => f.text);
			expect(replayed).to.deep.equal(range(2, 231));
			expect(gaps()).to.have.length(0);
			expect(await counter(ringFeedReplayFromDbTotal)).to.equal(fromDbBefore + 1);
			expect(await counter(ringFeedReplayGapTotal)).to.equal(gapsBefore);
		});

		it('when the durable replay hits its 2000-row cap the feed says so with system.gap (replay_limit)', async function () {
			this.timeout(90_000);
			const stop = client.subscribe({ roomId });
			await waitHandshakes(1);
			const first = publish(1);
			await waitTexts('evt-1');
			stop();

			const total = 2101;
			for (let n = 2; n <= total; n++) publish(n);
			await persisted(total);

			const started = Date.now();
			client.subscribe({ roomId, lastEventId: first.id });
			await client.waitFor(() => gaps().length > 0, 30_000, 'the replay_limit gap');
			note('2000-event durable replay then gap', Date.now() - started);

			const replayed = client.frames.filter((f) => f.sub === 2 && f.type === 'announce').map((f) => f.text);
			expect(replayed).to.have.length(2000);
			expect(replayed[0]).to.equal('evt-2');
			expect(replayed[1999]).to.equal('evt-2001');
			expect((gaps()[0]!.payload as { reason: string }).reason).to.equal('replay_limit');
			expect(gaps()).to.have.length(1);
		});
	});

	// -----------------------------------------------------------------------------------
	// 2. keepAlive
	// -----------------------------------------------------------------------------------
	describe('socket keep-alive (item 2)', () => {
		it('the server answers a bare PING with PONG', async () => {
			const token = await signToken(userA);
			const ws = new WebSocket(`ws://127.0.0.1:${server.port}/trpc?token=${encodeURIComponent(token)}`);
			const rtt = await new Promise<number>((resolve, reject) => {
				const timer = setTimeout(() => reject(new Error('no PONG within 5 s')), 5_000);
				ws.addEventListener('error', () => reject(new Error('socket error')));
				let at = 0;
				ws.addEventListener('open', () => {
					at = Date.now();
					ws.send('PING');
				});
				ws.addEventListener('message', (e) => {
					if (e.data === 'PONG') {
						clearTimeout(timer);
						resolve(Date.now() - at);
					}
				});
			});
			ws.close();
			note('PING to PONG round trip', rtt);
		});

		it('an idle, healthy connection stays open for 40 s with the app settings: no reconnect', async function () {
			this.timeout(70_000);
			client.subscribe({ roomId });
			await waitHandshakes(1);
			const t0 = Date.now();
			const opensAtStart = client.opens;
			const statesAtStart = client.stateLog.length;
			// Five heartbeats at 8 s each: 40 s of an idle subscription, awaited rather than slept.
			await client.waitFor(() => heartbeats().length >= 5, 55_000, 'five heartbeats');
			const idleMs = Date.now() - t0;
			note('idle soak (handshake to 5th heartbeat)', idleMs);

			expect(idleMs).to.be.at.least(38_000);
			expect(proxy.accepted, 'one TCP connection the whole time').to.equal(1);
			expect(client.opens).to.equal(opensAtStart);
			expect(client.closes).to.equal(0);
			expect(client.stateLog.slice(statesAtStart), 'no state change after the handshake').to.deep.equal([]);
			expect(handshakes()).to.have.length(1);
			// Every PING the client sent (it sends one whenever 8 s pass with no frame) was answered.
			expect(proxy.count('PONG')).to.equal(proxy.count('PING'));
			console.log(`      [observed] PINGs sent: ${proxy.count('PING')}, PONGs answered: ${proxy.count('PONG')}`);
			// Heartbeats come about every 8 s.
			const gapsBetween = heartbeats().slice(1).map((h, i) => h.at - heartbeats()[i]!.at);
			for (const g of gapsBetween) expect(g).to.be.within(7_000, 9_500);
		});
	});

	// -----------------------------------------------------------------------------------
	// 3. Socket death
	// -----------------------------------------------------------------------------------
	describe('socket death recovered by the transport itself (item 3)', () => {
		it('reconnects, re-sends the subscription with the last frame id, replays exactly the outage, in order', async () => {
			client.subscribe({ roomId });
			await waitHandshakes(1);
			publish(1);
			publish(2);
			publish(3);
			await waitTexts('evt-3');
			const lastBeforeKill = client.frames[client.frames.length - 1]!;

			proxy.setMode('refuse');
			const killedAt = Date.now();
			proxy.destroyAll();
			await client.waitFor(() => client.closes >= 1, 10_000, 'the client to see the socket close');
			// The client's first retry is immediate and refused; the next waits 2 s (wsClient's backoff).
			await poll(() => proxy.refused >= 1, 5_000, 'a refused reconnect attempt');
			for (let n = 4; n <= 8; n++) publish(n); // while the server is unreachable
			proxy.setMode('pass');
			await waitHandshakes(2);
			await waitTexts('evt-8');
			note('socket kill to second handshake (one refused attempt, 2 s backoff)', handshakes()[1]!.at - killedAt);

			const resub = proxy.subscriptionMessages().filter((m) => m.delivered).pop()!;
			expect(resub.params.lastEventId, 'the resent subscription carries the cursor').to.equal(lastBeforeKill.id);
			expect(proxy.accepted).to.be.greaterThan(1);
			// Exactly the outage's events, once each, in order; nothing from before it again.
			expect(client.eventTexts()).to.deep.equal(range(1, 8));
			expect(gaps()).to.have.length(0);
			await poll(async () => (await gauge()) === 1, 5_000, 'one live server-side subscription');
		});
	});

	// -----------------------------------------------------------------------------------
	// 4. Black hole
	// -----------------------------------------------------------------------------------
	describe('black hole: traffic dropped, socket not closed (item 4)', () => {
		it('the keep-alive notices in 8 to 18 s; the socket only closes when the network answers; then everything is replayed', async function () {
			this.timeout(90_000);
			const { HEARTBEAT_TIMEOUT_MS } = await loadAppFeedConnection();
			let stop = client.subscribe({ roomId });
			await waitHandshakes(1);
			publish(1);
			publish(2);
			await waitTexts('evt-2');
			const lastBeforeHole = client.frames[client.frames.length - 1]!;

			proxy.setMode('blackhole');
			const holeAt = Date.now();
			for (let n = 3; n <= 6; n++) publish(n); // the server writes these into the void

			// 1. The keep-alive: PING after 8 s of silence, `close()` 10 s after an unanswered PING.
			await client.waitFor(() => client.closeCalls.length >= 1, 40_000, "the keep-alive's pong timeout to call close()");
			const closeCalledAfter = client.closeCalls[0]! - holeAt;
			note('black hole to keep-alive close() call (detection)', closeCalledAfter);
			expect(client.closeCalls[0]! - lastBeforeHole.at, 'PING 8 s after the last frame, close 10 s after that').to.be.within(17_500, 18_500 + 8_000);
			expect(proxy.subscriptionMessages().length).to.equal(1);
			expect(proxy.count('PING')).to.be.greaterThan(0);

			// 2. The app's own watchdog is 20 s after the last frame (HEARTBEAT_TIMEOUT_MS). It is the
			// hook's timer, so here it is a timer: wait it out, then do what the hook does.
			const watchdogAt = lastBeforeHole.at + HEARTBEAT_TIMEOUT_MS;
			await sleep(Math.max(0, watchdogAt - Date.now()));
			// Whether the client has seen the socket close by now depends on the WebSocket
			// implementation's closing handshake (see docs/reference/feed-lab.md); record it.
			const stuck = client.closes === 0;
			note(`socket 'close' event seen when the app's watchdog fires (0 = stuck in CLOSING)`, client.closes);
			const statesWhenStuck = client.sockets.map((sock) => sock.readyState);
			console.log(`      [observed] WebSocket readyState per socket at watchdog time: ${statesWhenStuck.join(',')} (2 = CLOSING); close event seen: ${!stuck}`);
			stop();
			stop = client.subscribe({ roomId, lastEventId: lastBeforeHole.id, resumeAttempt: 1 }, () => {});

			// 3. The network comes back (the proxy resets the flows that lived through the hole).
			proxy.setMode('pass');
			const healedAt = Date.now();
			await waitHandshakes(2, 40_000);
			await waitTexts('evt-6', 10_000);
			note('network returns to second handshake and full replay', Date.now() - healedAt);

			expect(client.dedupedEventTexts()).to.deep.equal(range(1, 6));
			expect(gaps()).to.have.length(0);
			// Whatever the transport re-sent was the newest input, with a cursor.
			const last = proxy.subscriptionMessages().filter((m) => m.delivered).pop()!;
			expect((last.params.input as { resumeAttempt?: number }).resumeAttempt).to.equal(1);
			// The first send of a subscription carries its cursor in the input (the transport adds
			// `params.lastEventId` only after a data frame, on its own re-sends).
			expect((last.params.input as { lastEventId?: string }).lastEventId ?? last.params.lastEventId).to.equal(lastBeforeHole.id);
			await poll(async () => (await gauge()) === 1, 10_000, 'exactly one live server-side subscription (the dead one torn down)');
			stop();
		});
	});

	// -----------------------------------------------------------------------------------
	// 5. Chat must not wipe the cursor
	// -----------------------------------------------------------------------------------
	describe('chat frames and the resume cursor (item 5)', () => {
		it('with chat as the last real frame, the resent subscription still carries a cursor and the replay starts there', async () => {
			client.subscribe({ roomId });
			await waitHandshakes(1);
			publish(1);
			await waitTexts('evt-1');

			await chat.send({ roomId, senderUserId: userB, text: 'anyone there?' });
			await client.waitFor(() => client.frames.some((f) => f.type === 'chat'), 10_000, 'the chat frame');
			// The server follows the untracked chat frame with a tracked heartbeat.
			const chatIdx = client.frames.findIndex((f) => f.type === 'chat');
			const hb = await client.waitFor(() => client.frames.slice(chatIdx + 1).find((f) => f.type === 'heartbeat'), 10_000, 'the heartbeat after chat');

			proxy.setMode('refuse');
			proxy.destroyAll();
			await client.waitFor(() => client.closes >= 1, 10_000, 'the socket close');
			publish(2);
			publish(3);
			proxy.setMode('pass');
			await waitHandshakes(2);
			await waitTexts('evt-3');

			const resub = proxy.subscriptionMessages().filter((m) => m.delivered).pop()!;
			expect(resub.params.lastEventId, 'cursor must be the heartbeat that followed chat, not empty').to.equal(hb.id);
			// Had the cursor been wiped, the replay would be the last 100 events: evt-1 again.
			expect(client.eventTexts()).to.deep.equal(range(1, 3));
			expect(gaps()).to.have.length(0);
		});
	});

	// -----------------------------------------------------------------------------------
	// 7. Heartbeat cursors
	// -----------------------------------------------------------------------------------
	describe('a heartbeat id used as a cursor (item 7)', () => {
		/** Subscribes, publishes evt-1/2, makes the server emit a tracked heartbeat (via chat), and drops the subscription. */
		const reachHeartbeat = async () => {
			const stop = client.subscribe({ roomId });
			await waitHandshakes(1);
			publish(1);
			nextMillisecond();
			publish(2);
			await waitTexts('evt-2');
			nextMillisecond();
			await chat.send({ roomId, senderUserId: userB, text: 'hello' });
			const hb = await client.waitFor(() => heartbeats()[0], 10_000, 'a heartbeat');
			stop();
			nextMillisecond();
			return hb;
		};

		it('resolves: the events that followed are replayed and there is no spurious gap', async () => {
			const hb = await reachHeartbeat();
			publish(3);
			publish(4);
			await persisted(4);
			client.subscribe({ roomId, lastEventId: hb.id });
			await waitTexts('evt-4');
			expect(client.frames.filter((f) => f.sub === 2 && f.type === 'announce').map((f) => f.text)).to.deep.equal(['evt-3', 'evt-4']);
			expect(gaps()).to.have.length(0);
		});

		it('no gap when only events this player cannot see follow the heartbeat (10b #270)', async () => {
			const hb = await reachHeartbeat();
			// Something this player may not see happens after the heartbeat: B's private line.
			publish(3, { scope: 'private', targetUserId: userB });
			await persisted(3);
			client.subscribe({ roomId, lastEventId: hb.id });
			await waitHandshakes(2);
			// Give the replay a moment past the handshake: it is computed before the first live frame.
			await client.waitFor(() => client.frames.filter((f) => f.sub === 2).length >= 2 || gaps().length > 0, 5_000, 'the replay outcome').catch(() => {});
			await sleep(200);

			// Nothing was lost: the only later event is one this player could never see. This drew
			// "Some events were missed" until the bus learned to resolve an unlogged id by time
			// (`getEventsSince`, 10b #270).
			expect(gaps(), 'no gap line for events this player may not see').to.have.length(0);
		});
	});

	// -----------------------------------------------------------------------------------
	// 8. Both reconnect paths at once
	// -----------------------------------------------------------------------------------
	describe('the app resubscribes while the transport reconnects (item 8, client level)', () => {
		/*
		 * What `useRingFeed` does when it declares the connection lost (`handleConnectionLost`):
		 * the subscription input changes to { lastEventId: <last real event it saw>, resumeAttempt: n+1 },
		 * so the React adapter tears the old subscription down and opens a new one, and a subscription
		 * error starts the same path with the app's backoff (`reconnectDelayMs`). The hook's cursor is
		 * the last real EVENT (never a handshake, heartbeat or gap), unlike the transport's, which is
		 * the last frame. The panes then drop events whose id they already hold (`dedupedEventTexts`).
		 */
		const hookLike = async () => {
			const { reconnectDelayMs } = await loadAppFeedConnection();
			let attempt = 0;
			let failures = 0;
			let stopCurrent = () => {};
			const timers = new Set<ReturnType<typeof setTimeout>>();
			const realCursor = () =>
				[...client.frames].reverse().find((f) => !['handshake', 'heartbeat', 'system.gap', 'chat'].includes(f.type))?.id;
			const open = () => {
				attempt += 1;
				stopCurrent = client.subscribe({ roomId, lastEventId: realCursor(), resumeAttempt: attempt }, () => lost());
			};
			const lost = () => {
				stopCurrent();
				const delay = reconnectDelayMs(failures++, () => 0.5); // no jitter
				if (delay === 0) open();
				else {
					const t = setTimeout(() => {
						timers.delete(t);
						open();
					}, delay);
					timers.add(t);
				}
			};
			// A handshake ends the outage as far as the hook is concerned.
			const ok = () => {
				failures = 0;
			};
			return {
				start: () => {
					attempt = 0;
					stopCurrent = client.subscribe({ roomId, resumeAttempt: 0 }, () => lost());
				},
				lost,
				ok,
				stop: () => {
					for (const t of timers) clearTimeout(t);
					stopCurrent();
				},
			};
		};

		const settle = async (last: string) => {
			await waitTexts(last, 30_000);
			await sleep(2_500); // let a second replay from the transport's own resend arrive, if there will be one
		};

		it('error path: the hook resubscribes into a down socket (the subscribe fails), backs off, and the transport reconnects meanwhile', async () => {
			const hook = await hookLike();
			hook.start();
			await waitHandshakes(1);
			publish(1);
			publish(2);
			publish(3);
			await waitTexts('evt-3');

			proxy.setMode('refuse');
			proxy.destroyAll();
			await client.waitFor(() => client.closes >= 1, 10_000, 'the socket close');
			hook.lost(); // the hook's loss path fires while wsClient is in its own reconnect loop
			await poll(() => proxy.refused >= 2, 10_000, 'both paths refused at least once');
			for (let n = 4; n <= 8; n++) publish(n);
			proxy.setMode('pass');
			await settle('evt-8');

			expect(client.dedupedEventTexts()).to.deep.equal(range(1, 8));
			const raw = client.eventTexts().length;
			note('duplicate raw event deliveries, error-path race', raw - 8);
			console.log(`      [observed] subscription errors surfaced to the app: ${client.errors.length} (${[...new Set(client.errors.map((e) => e.message))].join(' | ')})`);
			expect(gaps()).to.have.length(0);
			await poll(async () => (await gauge()) === 1, 5_000, 'exactly one live server-side subscription');
			hook.stop();
			await poll(async () => (await gauge()) === 0, 5_000, 'the last subscription torn down');
		});

		it('overlap: the new subscription opens a socket while the transport is still backing off, then the transport reconnects over it', async () => {
			let stop = client.subscribe({ roomId });
			await waitHandshakes(1);
			publish(1);
			publish(2);
			publish(3);
			await waitTexts('evt-3');
			const cursor = client.frames.filter((f) => f.type === 'announce').pop()!.id;

			proxy.setMode('refuse');
			proxy.destroyAll();
			await client.waitFor(() => client.closes >= 1, 10_000, 'the socket close');
			await poll(() => proxy.refused >= 1, 5_000, "the transport's refused first retry"); // now it sleeps 2 s
			for (let n = 4; n <= 8; n++) publish(n);
			proxy.setMode('pass');
			// The hook's resubscribe lands inside the transport's 2 s sleep and opens the socket itself.
			stop();
			stop = client.subscribe({ roomId, lastEventId: cursor, resumeAttempt: 1 });
			await settle('evt-8');

			expect(client.dedupedEventTexts()).to.deep.equal(range(1, 8));
			const raw = client.eventTexts().length;
			note('duplicate raw event deliveries, overlap race', raw - 8);
			console.log(`      [observed] sockets accepted by the proxy: ${proxy.accepted} (${proxy.refused} refused), handshakes: ${handshakes().length}; accept log: ${proxy.acceptLog.map((a) => `${a.at - proxy.acceptLog[0]!.at}ms:${a.mode}`).join(' ')}`);
			expect(gaps()).to.have.length(0);
			// Observed: when the transport's backoff ends it closes the socket the new subscription
			// opened and reopens, and wsClient answers each of those closes with another reconnect:
			// about 16 connections in ~100 ms, then it settles. Bounded, and nothing is lost; the
			// bound is here so a retry storm that does not settle fails the suite.
			expect(proxy.accepted, 'the reconnect burst must settle').to.be.below(40);
			await poll(async () => (await gauge()) === 1, 5_000, 'exactly one live server-side subscription');
			stop();
		});

		it('socket up: the hook resubscribes on a live socket (a watchdog false positive) with no loss, no leak', async () => {
			let stop = client.subscribe({ roomId });
			await waitHandshakes(1);
			publish(1);
			publish(2);
			await waitTexts('evt-2');
			const cursor = client.frames.filter((f) => f.type === 'announce').pop()!.id;

			stop();
			publish(3); // lands between the old subscription's death and the new one's replay
			stop = client.subscribe({ roomId, lastEventId: cursor, resumeAttempt: 1 });
			publish(4);
			await waitTexts('evt-4');
			publish(5);
			await waitTexts('evt-5');

			expect(client.dedupedEventTexts()).to.deep.equal(range(1, 5));
			expect(proxy.accepted, 'same socket, no reconnect').to.equal(1);
			expect(gaps()).to.have.length(0);
			await poll(async () => (await gauge()) === 1, 5_000, 'exactly one live server-side subscription');
			stop();
		});
	});
});
