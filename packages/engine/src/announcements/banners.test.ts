import { expect } from 'chai';

import { announceNextRound } from './nextRound.js';
import { announceNextTurn } from './nextTurn.js';

function capture() {
	const published: Array<{ text: string }> = [];
	return {
		eb: { publish: (event: { text: string }) => published.push(event) } as any,
		published,
	};
}

const contestants = [
	{ monster: { identityWithHp: '🐍 Killer Killer (35 hp)' } },
	{ monster: { identityWithHp: '🌟 Dragon Blood (32 hp)' } },
];

/**
 * Both banners used to open with 21 dice, U+2680–U+2685, which JetBrains Mono does not
 * ship — so they rendered as a row of tofu boxes and wrapped to two lines on a phone,
 * on every single turn. See 10b-bugs-fixed.md #101.
 */
const DICE_FACES = /[⚀-⚅]/;

describe('round and turn banners', () => {
	it('the turn banner carries no unrenderable dice-face codepoints', () => {
		const { eb, published } = capture();
		announceNextTurn(eb, 'Ring', {}, { contestants, round: 1, turn: 0 } as any);

		expect(published[0]!.text).to.not.match(DICE_FACES);
	});

	it('the round banner carries none either', () => {
		const { eb, published } = capture();
		announceNextRound(eb, 'Ring', {}, { round: 0 });

		expect(published[0]!.text).to.not.match(DICE_FACES);
	});

	it('keeps the dice motif on turns, as an emoji that renders', () => {
		const { eb, published } = capture();
		announceNextTurn(eb, 'Ring', {}, { contestants, round: 1, turn: 0 } as any);

		expect(published[0]!.text).to.include('🎲');
		expect(published[0]!.text).to.include('round 1, turn 1');
	});

	it('still names the contestants and their hp', () => {
		const { eb, published } = capture();
		announceNextTurn(eb, 'Ring', {}, { contestants, round: 1, turn: 0 } as any);

		expect(published[0]!.text).to.include('🐍 Killer Killer (35 hp) vs 🌟 Dragon Blood (32 hp)');
	});

	it('keeps every banner line inside a phone width', () => {
		// The point of the change: 21 dice plus separators ran ~41 characters and wrapped.
		const { eb, published } = capture();
		announceNextTurn(eb, 'Ring', {}, { contestants, round: 1, turn: 0 } as any);
		announceNextRound(eb, 'Ring', {}, { round: 0 });

		const bannerLines = published
			.flatMap((event) => event.text.split('\n'))
			.filter((line) => !line.includes('vs'));

		for (const line of bannerLines) {
			expect(line.length, `too wide for a phone: "${line}"`).to.be.at.most(32);
		}
	});
});
