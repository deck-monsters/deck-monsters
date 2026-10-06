import { expect } from 'chai';

import { announceRolled } from './rolled.js';
import type { FeedLine } from '../events/types.js';
import type { RoomEventBus } from '../events/index.js';

function makeEb(onPublish: (text: string) => void): RoomEventBus {
	return {
		publish: ({ text }: { text: string }) => {
			onPublish(text);
			return { id: '1', roomId: 'test', timestamp: 0, type: 'announce', scope: 'public', text, payload: {} };
		},
	} as unknown as RoomEventBus;
}

describe('./announcements/rolled.ts', () => {
	it('announces a partial roll payload without crashing', () => {
		let publishedText = '';
		const eb = makeEb((text) => {
			publishedText = text;
		});

		announceRolled(eb, '', {}, {
			reason: 'to determine how much to drink.',
			roll: { result: 5 },
			who: { givenName: 'Player' },
			outcome: 'Player grows stronger...',
		});

		expect(publishedText).to.include('Player rolled _5_ to determine how much to drink.');
		expect(publishedText).to.not.include('undefined');
		expect(publishedText).to.include('🎲 *5*');
	});
});


describe('structured roll fidelity', () => {
	function capture(options: Parameters<typeof announceRolled>[3]) {
		let event!: { text: string; payload: { lines: FeedLine[] } };
		const eb = { publish: (published: typeof event) => { event = published; } } as unknown as RoomEventBus;
		announceRolled(eb, '', {}, options);
		const cleanedText = event.text.split('\n').map(line => line.trim()).filter(Boolean);
		expect(event.payload.lines.map(line => line.text)).to.deep.equal(cleanedText);
		expect(JSON.parse(JSON.stringify(event.payload.lines))).to.deep.equal(event.payload.lines);
		return event;
	}

	it('preserves Blink combined natural and labelled results without fictional numeric facts', () => {
		const event = capture({
			who: { givenName: 'Blink' }, reason: 'to steal potential energy.',
			roll: { primaryDice: '1d4 (hp) & 1d10 (xp)', naturalRoll: { result: '2 & 9' },
				bonusResult: 0, modifier: 0, result: '2 (hp) & 9 (xp)' },
			outcome: 'Blink steals potential energy.',
		});
		expect(event.text).to.equal('Blink rolled _2 & 9 on 1d4 (hp) & 1d10 (xp)_ to steal potential energy.\n🎲 *2 (hp) & 9 (xp)*\n    Blink steals potential energy.\n ');
		for (const line of event.payload.lines.slice(0, 2)) {
			expect(line).not.to.have.property('natural');
			expect(line).not.to.have.property('total');
			expect(line).not.to.have.property('result');
		}
	});

	it('preserves an opaque result-only roll without claiming it succeeded', () => {
		const event = capture({ who: { givenName: 'Blink' }, reason: 'for energy.', roll: { result: '2 (hp) & 9 (xp)' } });
		expect(event.text).to.include('Blink rolled _2 (hp) & 9 (xp)_ for energy.');
		expect(event.payload.lines[0]).not.to.have.property('natural');
		expect(event.payload.lines[0]).not.to.have.property('total');
		expect(event.payload.lines[0]).not.to.have.property('result');
	});

	for (const primaryDice of [undefined, '1d6']) it(`uses the actual natural and total for a numeric result-only roll (${primaryDice ?? 'unnamed die'})`, () => {
		const event = capture({ who: { givenName: 'Player' }, reason: 'for damage.', roll: { result: 5, primaryDice } });
		expect(event.payload.lines[0]).to.include({ natural: 5, bonus: 0, total: 5, result: 'success' });
		expect(event.payload.lines[1]).to.include({ total: 5, result: 'success' });
	});

	it('keeps a numeric detailed roll and its twin text consistent', () => {
		const event = capture({ who: { givenName: 'Player' }, reason: 'to hit.', vs: 8, success: true,
			roll: { naturalRoll: { result: 6 }, bonusResult: 1, modifier: 1, result: 8 } });
		expect(event.text).to.equal('Player rolled _6 +1 +1_ to hit.\n🎲 *8 v 8*\n ');
		expect(event.payload.lines[0]).to.include({ natural: 6, bonus: 2, total: 8, vs: 8, result: 'success' });
	});

	it('omits a missing natural even when the total is numeric', () => {
		const event = capture({ who: { givenName: 'Player' }, reason: 'for damage.', roll: { result: 5, modifier: 2 } });
		expect(event.payload.lines[0]).not.to.have.property('natural');
		expect(event.payload.lines[0]).to.include({ total: 5, bonus: 2 });
	});
});
