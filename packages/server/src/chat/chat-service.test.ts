import { expect } from 'chai';

import { ChatError, isVisibleTo, matchRecipient, type ChatMessage } from './chat-service.js';
import { FakeChatService, player } from './chat-service.test-helpers.js';

const ROOM = 'aaaaaaaa-0000-0000-0000-000000000001';
const OTHER_ROOM = 'aaaaaaaa-0000-0000-0000-000000000002';
const ADA = '11111111-0000-0000-0000-000000000001';
const BEN = '11111111-0000-0000-0000-000000000002';
const CAL = '11111111-0000-0000-0000-000000000003';

function service() {
	const s = new FakeChatService();
	s.players = [player(ADA, 'Ada'), player(BEN, 'Anthony Bourdain', 'Ben'), player(CAL, 'Anthony', 'Cal')];
	return s;
}

async function code(p: Promise<unknown>): Promise<string> {
	try {
		await p;
	} catch (err) {
		if (err instanceof ChatError) return `${err.code}|${err.message}`;
		throw err;
	}
	return 'ok';
}

describe('ChatService.send validation', () => {
	it('refuses empty and whitespace-only text with the plan text', async () => {
		const s = service();
		expect(await code(s.send({ roomId: ROOM, senderUserId: ADA, text: '   ' }))).to.equal(
			'empty|Say something after msg, like: msg nice hit, Fang!'
		);
	});

	it('refuses text over 500 characters and says how long it was', async () => {
		const s = service();
		expect(await code(s.send({ roomId: ROOM, senderUserId: ADA, text: 'x'.repeat(501) }))).to.equal(
			'too_long|Messages can be up to 500 characters. That one has 501.'
		);
		await s.send({ roomId: ROOM, senderUserId: ADA, text: 'x'.repeat(500) });
	});

	it('trims the stored text and strips control characters', async () => {
		const s = service();
		const m = await s.send({ roomId: ROOM, senderUserId: ADA, text: '  hi\u0000 there  ' });
		expect(m.text).to.equal('hi there');
		expect(s.stored[0]?.['text']).to.equal('hi there');
	});

	it('turns line breaks and tabs into single spaces and collapses runs', async () => {
		const s = service();
		expect((await s.send({ roomId: ROOM, senderUserId: ADA, text: 'hello\nworld' })).text).to.equal('hello world');
		expect((await s.send({ roomId: ROOM, senderUserId: BEN, text: 'a\r\n\r\nb\t\tc   d\re' })).text).to.equal('a b c d e');
	});

	it('treats whitespace and zero-width characters alone as empty', async () => {
		const s = service();
		expect((await code(s.send({ roomId: ROOM, senderUserId: ADA, text: ' \u200B\u200D\u2060\uFEFF \n' }))).split('|')[0]).to.equal('empty');
	});

	it('counts the 500 limit in code points, and reports that count', async () => {
		const s = service();
		await s.send({ roomId: ROOM, senderUserId: ADA, text: '\u{1F600}'.repeat(500) });
		expect(await code(s.send({ roomId: ROOM, senderUserId: BEN, text: '\u{1F600}'.repeat(501) }))).to.equal(
			'too_long|Messages can be up to 500 characters. That one has 501.'
		);
	});

	it('refuses a DM to yourself and to a non-member', async () => {
		const s = service();
		expect(await code(s.send({ roomId: ROOM, senderUserId: ADA, text: 'hi', toUserId: ADA }))).to.equal(
			"self|That's you. Pick someone else."
		);
		expect(
			(await code(s.send({ roomId: ROOM, senderUserId: ADA, text: 'hi', toUserId: 'ffffffff-0000-0000-0000-000000000000' }))).split('|')[0]
		).to.equal('not_member');
		expect(s.stored).to.have.length(0);
	});

	it('limits a player to 5 messages in 10 seconds, per room and player', async () => {
		const s = service();
		for (let i = 0; i < 5; i++) await s.send({ roomId: ROOM, senderUserId: ADA, text: `m${i}` });
		expect(await code(s.send({ roomId: ROOM, senderUserId: ADA, text: 'sixth' }))).to.equal(
			'rate_limited|Easy there. Wait a few seconds before the next message.'
		);
		// Another player, and the same player in another room, have their own allowance.
		await s.send({ roomId: ROOM, senderUserId: BEN, text: 'hi' });
		await s.send({ roomId: OTHER_ROOM, senderUserId: ADA, text: 'hi' });
		// The window slides.
		s.clock += 10_000;
		await s.send({ roomId: ROOM, senderUserId: ADA, text: 'again' });
	});

	it('does not count a refused message against the limit', async () => {
		const s = service();
		for (let i = 0; i < 10; i++) await code(s.send({ roomId: ROOM, senderUserId: ADA, text: '' }));
		await s.send({ roomId: ROOM, senderUserId: ADA, text: 'still fine' });
	});

	it('stamps the fight number when a fight is on, and null otherwise', async () => {
		const s = service();
		expect((await s.send({ roomId: ROOM, senderUserId: ADA, text: 'quiet' })).fightNumber).to.equal(null);
		s.fight = 8;
		expect((await s.send({ roomId: ROOM, senderUserId: BEN, text: 'go!' })).fightNumber).to.equal(8);
	});

	it('records the source, defaulting to web', async () => {
		const s = service();
		expect((await s.send({ roomId: ROOM, senderUserId: ADA, text: 'a' })).source).to.equal('web');
		expect((await s.send({ roomId: ROOM, senderUserId: ADA, text: 'b', source: 'discord' })).source).to.equal('discord');
	});

	it('names the sender and recipient from the player list', async () => {
		const s = service();
		const m = await s.send({ roomId: ROOM, senderUserId: ADA, text: 'psst', toUserId: BEN });
		expect(m.senderName).to.equal('Ada');
		expect(m.recipientName).to.equal('Anthony Bourdain');
		expect(m.recipientUserId).to.equal(BEN);
	});
});

describe('ChatService.resolveRecipient', () => {
	it('matches a name with a space and returns the rest as the message', async () => {
		const s = service();
		expect(await s.resolveRecipient(ROOM, 'Anthony Bourdain good luck tonight')).to.deep.equal({
			userId: BEN,
			name: 'Anthony Bourdain',
			message: 'good luck tonight',
		});
	});

	it('takes the longest match, case-insensitively', async () => {
		const s = service();
		expect(await s.resolveRecipient(ROOM, 'anthony bourdain hi')).to.include({ userId: BEN, message: 'hi' });
		expect(await s.resolveRecipient(ROOM, 'ANTHONY hello there')).to.include({ userId: CAL, message: 'hello there' });
	});

	it('matches a display name as well as a character name', async () => {
		const s = service();
		expect(await s.resolveRecipient(ROOM, 'Ben nice one')).to.include({ userId: BEN, name: 'Anthony Bourdain', message: 'nice one' });
	});

	it('needs a word boundary after the name', async () => {
		const s = service();
		expect(await s.resolveRecipient(ROOM, 'Adam hello')).to.deep.equal({ error: 'no_such_player' });
		expect(await s.resolveRecipient(ROOM, 'nobody hi')).to.deep.equal({ error: 'no_such_player' });
	});

	it('returns an empty message when only the name was given', async () => {
		const s = service();
		expect(await s.resolveRecipient(ROOM, 'Ada')).to.deep.equal({ userId: ADA, name: 'Ada', message: '' });
	});
});

describe('matchRecipient', () => {
	it('ignores blank candidate names', () => {
		expect(matchRecipient([{ userId: 'u', name: '', match: '' }], 'hello')).to.equal(null);
	});
});

describe('ChatService.subscribe', () => {
	it('delivers room messages to everyone in the room, and only that room', async () => {
		const s = service();
		const got: ChatMessage[] = [];
		const other: ChatMessage[] = [];
		s.subscribe(ROOM, BEN, (m) => got.push(m));
		s.subscribe(OTHER_ROOM, BEN, (m) => other.push(m));
		await s.send({ roomId: ROOM, senderUserId: ADA, text: 'hello all' });
		expect(got.map((m) => m.text)).to.deep.equal(['hello all']);
		expect(other).to.have.length(0);
	});

	it('delivers a DM only to its sender and recipient', async () => {
		const s = service();
		const seen: Record<string, string[]> = { [ADA]: [], [BEN]: [], [CAL]: [] };
		for (const id of [ADA, BEN, CAL]) s.subscribe(ROOM, id, (m) => seen[id]!.push(m.text));
		await s.send({ roomId: ROOM, senderUserId: ADA, text: 'secret', toUserId: BEN });
		expect(seen[ADA]).to.deep.equal(['secret']);
		expect(seen[BEN]).to.deep.equal(['secret']);
		expect(seen[CAL]).to.deep.equal([]);
	});

	it('stops delivering after unsubscribe, and survives a throwing listener', async () => {
		const s = service();
		const got: string[] = [];
		const off = s.subscribe(ROOM, BEN, (m) => got.push(m.text));
		s.subscribe(ROOM, CAL, () => {
			throw new Error('boom');
		});
		await s.send({ roomId: ROOM, senderUserId: ADA, text: 'one' });
		off();
		await s.send({ roomId: ROOM, senderUserId: ADA, text: 'two' });
		expect(got).to.deep.equal(['one']);
	});
});

describe('isVisibleTo', () => {
	it('shows room messages to all and DMs to their two players', () => {
		const room = { senderUserId: ADA, recipientUserId: null };
		const dm = { senderUserId: ADA, recipientUserId: BEN };
		expect(isVisibleTo(room, CAL)).to.equal(true);
		expect(isVisibleTo(dm, ADA)).to.equal(true);
		expect(isVisibleTo(dm, BEN)).to.equal(true);
		expect(isVisibleTo(dm, CAL)).to.equal(false);
	});
});
