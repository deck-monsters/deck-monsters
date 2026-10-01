import { expect } from 'chai';
import { TRPCError } from '@trpc/server';

import { FakeChatService, player } from '../chat/chat-service.test-helpers.js';
import { activeFlows, activePromptFreeMutations, createRouter, parseChatCommand } from './router.js';

const ROOM_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const ADA = '11111111-2222-3333-4444-555555555551';
const BEN = '11111111-2222-3333-4444-555555555552';
const CAL = '11111111-2222-3333-4444-555555555553';
const OUTSIDER = '99999999-2222-3333-4444-555555555555';

const members = new Set([ADA, BEN, CAL]);

function build() {
	const chat = new FakeChatService();
	chat.players = [player(ADA, 'Ada'), player(BEN, 'Ben'), player(CAL, 'Cal')];
	const roomManager = {
		assertMember: async (userId: string) => {
			if (!members.has(userId)) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member of this room' });
		},
		getEventBus: async () => ({
			getEventsSince: () => ({ events: [], truncated: false, upToDate: true, status: 'ok' }),
			getRecentEvents: () => [],
			subscribe: () => () => {},
		}),
		getGame: async () => ({
			ring: { nextFightAt: null, nextBossSpawnAt: null, contestants: [], inEncounter: false, contestantSnapshots: () => [] },
		}),
	} as unknown as Parameters<typeof createRouter>[0];
	const router = createRouter(roomManager, chat);
	const as = (userId: string) => router.createCaller({ userId, serviceTokenValid: false });
	return { chat, as };
}

describe('trpc chat router', () => {
	it('refuses a non-member on every chat procedure', async () => {
		const { as } = build();
		const caller = as(OUTSIDER);
		const calls: Array<[string, () => Promise<unknown>]> = [
			['send', () => caller.chat.send({ roomId: ROOM_ID, text: 'hi' })],
			['history', () => caller.chat.history({ roomId: ROOM_ID })],
			['markRead', () => caller.chat.markRead({ roomId: ROOM_ID, lastReadId: 1 })],
			['unread', () => caller.chat.unread({ roomId: ROOM_ID })],
			['members', () => caller.chat.members({ roomId: ROOM_ID })],
		];
		for (const [name, call] of calls) {
			const err = await call().catch((e: unknown) => e);
			expect(err, name).to.be.instanceOf(TRPCError);
			expect((err as TRPCError).code, name).to.equal('FORBIDDEN');
		}
	});

	it('returns the stored message from send', async () => {
		const { as } = build();
		const m = await as(ADA).chat.send({ roomId: ROOM_ID, text: ' hello ' });
		expect(m).to.include({ senderUserId: ADA, text: 'hello', recipientUserId: null, source: 'web' });
	});

	it('counts a Chat tab send and a Console msg as presence, but not a refused send', async () => {
		const { chat, as } = build();
		await as(ADA).chat.send({ roomId: ROOM_ID, text: 'hello' });
		expect(chat.seen).to.deep.equal([`${ROOM_ID}:${ADA}`]);
		await as(BEN).game.command({ roomId: ROOM_ID, command: 'msg hi' }).catch(() => undefined);
		await as(CAL).chat.send({ roomId: ROOM_ID, text: 'x'.repeat(501) }).catch(() => undefined);
		expect(chat.seen).to.deep.equal([`${ROOM_ID}:${ADA}`, `${ROOM_ID}:${BEN}`]);
	});

	it('turns a chat refusal into BAD_REQUEST carrying the player-facing text and code', async () => {
		const { as } = build();
		const err = (await as(ADA).chat.send({ roomId: ROOM_ID, text: 'x'.repeat(501) }).catch((e: unknown) => e)) as TRPCError;
		expect(err).to.be.instanceOf(TRPCError);
		expect(err.code).to.equal('BAD_REQUEST');
		expect(err.message).to.equal('Messages can be up to 500 characters. That one has 501.');
		expect((err.cause as { code?: string }).code).to.equal('too_long');
	});

	it('lists the other members for the To picker', async () => {
		const { chat, as } = build();
		chat.members = async (_room: string, userId: string) =>
			chat.players.filter((p) => p.userId !== userId).map(({ userId: id, name }) => ({ userId: id, name }));
		const list = await as(ADA).chat.members({ roomId: ROOM_ID });
		expect(list.map((p) => p.name)).to.deep.equal(['Ben', 'Cal']);
	});
});

describe('trpc ringFeed chat frames', () => {
	type Frame = unknown;
	const asFrame = (f: Frame) => (Array.isArray(f) ? { tracked: true, value: f[1] } : { tracked: false, value: f }) as {
		tracked: boolean;
		value: { type: string; id: string; payload?: { text: string } };
	};

	it('delivers a DM frame only to its two players, as an untracked chat frame', async () => {
		const { chat, as } = build();
		const open = async (userId: string) => {
			const it = (await as(userId).game.ringFeed({ roomId: ROOM_ID })) as AsyncGenerator<unknown>;
			const first = asFrame((await it.next()).value);
			expect(first.value.type).to.equal('handshake');
			return it;
		};
		const [a, b, c] = [await open(ADA), await open(BEN), await open(CAL)];
		try {
			// The generator attaches its chat subscription when resumed past the handshake, so
			// start pulling first (as a connected client does), let it attach, then send.
			const pulls = [a, b, c].map((it) => it.next());
			await new Promise((resolve) => setImmediate(resolve));
			await chat.send({ roomId: ROOM_ID, senderUserId: ADA, text: 'secret', toUserId: BEN });
			await chat.send({ roomId: ROOM_ID, senderUserId: ADA, text: 'for everyone' });

			for (const [it, pull] of [[a, pulls[0]!], [b, pulls[1]!]] as const) {
				const dm = asFrame((await pull).value);
				expect(dm.tracked).to.equal(false);
				expect(dm.value.type).to.equal('chat');
				expect(dm.value.id).to.equal('chat-1');
				expect(dm.value.payload?.text).to.equal('secret');
				const all = asFrame((await it.next()).value);
				expect(all.value.payload?.text).to.equal('for everyone');
			}
			// The bystander's very first frame is the room message: the DM never reached them.
			const first = asFrame((await pulls[2]!).value);
			expect(first.value.id).to.equal('chat-2');
			expect(first.value.payload?.text).to.equal('for everyone');
		} finally {
			await Promise.all([a.return?.(undefined), b.return?.(undefined), c.return?.(undefined)]);
		}
	});

	it('buffers chat sent right after the handshake, before the client pulls again', async () => {
		// The client fetches chat.history on seeing the handshake; a message sent after that
		// fetch but before the feed is pulled again must not fall in a gap.
		const { chat, as } = build();
		const it = (await as(ADA).game.ringFeed({ roomId: ROOM_ID })) as AsyncGenerator<unknown>;
		expect(asFrame((await it.next()).value).value.type).to.equal('handshake');
		await chat.send({ roomId: ROOM_ID, senderUserId: BEN, text: 'in the gap' });
		const next = asFrame((await it.next()).value);
		expect(next.value.type).to.equal('chat');
		expect(next.value.payload?.text).to.equal('in the gap');
		await it.return?.(undefined);
	});

	it('releases the chat subscription when the client leaves during the handshake', async () => {
		const { chat, as } = build();
		const it = (await as(ADA).game.ringFeed({ roomId: ROOM_ID })) as AsyncGenerator<unknown>;
		await it.next();
		expect(chat.listenerCount(ROOM_ID)).to.equal(1);
		await it.return?.(undefined);
		expect(chat.listenerCount(ROOM_ID)).to.equal(0);
	});

	it('stops listening to chat when the feed closes', async () => {
		const { chat, as } = build();
		const it = (await as(ADA).game.ringFeed({ roomId: ROOM_ID })) as AsyncGenerator<unknown>;
		await it.next();
		const pending = it.next();
		await new Promise((resolve) => setImmediate(resolve));
		expect(chat.listenerCount(ROOM_ID)).to.equal(1);
		await chat.send({ roomId: ROOM_ID, senderUserId: BEN, text: 'one' });
		await pending;
		await it.return?.(undefined);
		expect(chat.listenerCount(ROOM_ID)).to.equal(0);
		await chat.send({ roomId: ROOM_ID, senderUserId: BEN, text: 'anyone?' });
	});
});

describe('trpc game.command: chat commands', () => {
	/** A room manager that counts every engine-side touch: chat must make none. */
	function buildCommand() {
		const chat = new FakeChatService();
		chat.players = [
			player(ADA, 'Ada'),
			player(BEN, 'Anthony Bourdain'),
			player(CAL, 'Anthony'),
		];
		let engineTouches = 0;
		const touch = () => {
			engineTouches += 1;
			throw new Error('chat must not reach the engine');
		};
		const roomManager = {
			assertMember: async (userId: string) => {
				if (!members.has(userId)) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member of this room' });
			},
			getMemberRole: touch,
			getDisplayName: touch,
			getGame: touch,
			getEventBus: touch,
		} as unknown as Parameters<typeof createRouter>[0];
		const caller = createRouter(roomManager, chat).createCaller({ userId: ADA, serviceTokenValid: false });
		return { chat, caller, touches: () => engineTouches };
	}

	afterEach(() => {
		activeFlows.clear();
		activePromptFreeMutations.clear();
	});

	it('routes msg, message, m (any case) to a room message and dm to a private one', async () => {
		const { chat, caller, touches } = buildCommand();
		for (const command of ['msg hello', 'message hello', 'M hello', 'MSG   hello']) {
			expect(await caller.game.command({ roomId: ROOM_ID, command }), command).to.deep.equal({ ok: true });
		}
		expect(chat.stored.map((r) => [r.text, r.recipientUserId])).to.deep.equal([
			['hello', null],
			['hello', null],
			['hello', null],
			['hello', null],
		]);
		expect(await caller.game.command({ roomId: ROOM_ID, command: 'dm Anthony Bourdain good luck' })).to.deep.equal({ ok: true });
		expect(chat.stored[4]).to.include({ text: 'good luck', recipientUserId: BEN });
		expect(touches()).to.equal(0);
	});

	it('dm uses the shared matcher: a name with a space, and quotes for the shorter name', async () => {
		const { chat, caller } = buildCommand();
		await caller.game.command({ roomId: ROOM_ID, command: 'dm Anthony Bourdain is too powerful' });
		await caller.game.command({ roomId: ROOM_ID, command: 'dm "Anthony" Bourdain is too powerful' });
		expect(chat.stored.map((r) => [r.recipientUserId, r.text])).to.deep.equal([
			[BEN, 'is too powerful'],
			[CAL, 'Bourdain is too powerful'],
		]);
	});

	it('works while the player has a flow in progress or a workshop mutation running', async () => {
		const { chat, caller, touches } = buildCommand();
		activeFlows.set(`${ROOM_ID}:${ADA}`, 'flow-token');
		activePromptFreeMutations.set(`${ROOM_ID}:${ADA}`, 'mutation-token');
		expect(await caller.game.command({ roomId: ROOM_ID, command: 'msg still here' })).to.deep.equal({ ok: true });
		expect(chat.stored).to.have.length(1);
		expect(touches()).to.equal(0);
		// The flow's lock is untouched.
		expect(activeFlows.get(`${ROOM_ID}:${ADA}`)).to.equal('flow-token');
	});

	it('returns each refusal as the shared failed-command shape with the exact plan text', async () => {
		const { caller, chat } = buildCommand();
		const refuse = async (command: string) => caller.game.command({ roomId: ROOM_ID, command });
		expect(await refuse('msg')).to.deep.equal({ ok: false, message: 'Say something after msg, like: msg nice hit, Fang!' });
		expect(await refuse('m   ')).to.deep.equal({ ok: false, message: 'Say something after msg, like: msg nice hit, Fang!' });
		expect(await refuse('dm Nobody hi')).to.deep.equal({
			ok: false,
			message: 'Nobody in this room goes by that name. Use the name as it shows in Chat, like: dm Ada good luck.',
		});
		expect(await refuse('dm')).to.deep.equal({
			ok: false,
			message: "Type dm, a player's name, and your message, like: dm Ada good luck.",
		});
		expect(await refuse('dm   ')).to.deep.include({ ok: false });
		// Yourself, even with no message: the self refusal comes first, as in the preview.
		expect(await refuse('dm Ada')).to.deep.equal({ ok: false, message: "That's you. Pick someone else." });
		expect(await refuse('dm Ada hi')).to.deep.equal({ ok: false, message: "That's you. Pick someone else." });
		expect(await refuse('dm Anthony Bourdain')).to.deep.equal({
			ok: false,
			message: 'Add a message after the name, like: dm Anthony Bourdain good luck.',
		});
		expect(await refuse(`msg ${'x'.repeat(501)}`)).to.deep.equal({
			ok: false,
			message: 'Messages can be up to 500 characters. That one has 501.',
		});
		chat.stored.length = 0;
		for (let i = 0; i < 5; i++) await refuse('msg ok');
		expect(await refuse('msg too fast')).to.deep.equal({
			ok: false,
			message: 'Easy there. Wait a few seconds before the next message.',
		});
	});

	it('refuses two players with one name, and still sends by id', async () => {
		const { chat, caller } = buildCommand();
		chat.players = [player(ADA, 'Ada'), player(BEN, 'Sam'), player(CAL, 'Sam')];
		expect(await caller.game.command({ roomId: ROOM_ID, command: 'dm Sam hello' })).to.deep.equal({
			ok: false,
			message: 'Two players here go by Sam. Pick one from the list.',
		});
		expect(await caller.game.command({ roomId: ROOM_ID, command: 'dm "sam" hello' })).to.deep.include({ ok: false });
		expect(chat.stored).to.have.length(0);
		// The picker path sends the id (chat.send), which never re-parses the name.
		await chat.send({ roomId: ROOM_ID, senderUserId: ADA, text: 'hello', toUserId: CAL });
		expect(chat.stored[0]).to.include({ recipientUserId: CAL });
	});

	it('exposes the exact names dm matches against, the caller included, via chat.dmNames', async () => {
		const { chat, caller } = buildCommand();
		chat.players = [player(ADA, 'Ada', 'ada@x'), player(BEN, 'Anthony Bourdain', 'Ben')];
		const names = await caller.chat.dmNames({ roomId: ROOM_ID });
		expect(names).to.deep.equal([
			{ userId: ADA, name: 'Ada', match: 'Ada' },
			{ userId: ADA, name: 'Ada', match: 'ada@x' },
			{ userId: BEN, name: 'Anthony Bourdain', match: 'Anthony Bourdain' },
			{ userId: BEN, name: 'Anthony Bourdain', match: 'Ben' },
		]);
	});

	it('refuses a non-member before anything else', async () => {
		const { chat, caller } = buildCommand();
		const outsider = createRouter(
			{ assertMember: async () => { throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member of this room' }); } } as never,
			chat
		).createCaller({ userId: OUTSIDER, serviceTokenValid: false });
		const err = await outsider.game.command({ roomId: ROOM_ID, command: 'msg hi' }).catch((e: unknown) => e);
		expect((err as TRPCError).code).to.equal('FORBIDDEN');
		expect(caller).to.be.ok;
		expect(chat.stored).to.have.length(0);
	});
});

describe('parseChatCommand', () => {
	it('recognises the four command words and nothing that merely starts with them', () => {
		expect(parseChatCommand('msg hi')).to.deep.equal({ kind: 'msg', rest: 'hi' });
		expect(parseChatCommand('  Message   hi there ')).to.deep.equal({ kind: 'msg', rest: 'hi there' });
		expect(parseChatCommand('m')).to.deep.equal({ kind: 'msg', rest: '' });
		expect(parseChatCommand('DM Ada hi')).to.deep.equal({ kind: 'dm', rest: 'Ada hi' });
		for (const not of ['mm hi', 'dmx hi', 'message-board', 'monsters', 'dismiss Fluffy', 'mmsg', 'help']) {
			expect(parseChatCommand(not), not).to.equal(null);
		}
	});
});
