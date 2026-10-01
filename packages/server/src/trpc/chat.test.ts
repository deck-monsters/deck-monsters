import { expect } from 'chai';
import { TRPCError } from '@trpc/server';

import { FakeChatService, player } from '../chat/chat-service.test-helpers.js';
import { createRouter } from './router.js';

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
