import { expect } from 'chai';
import sinon from 'sinon';

import { announceFightConcludes } from './fightConcludes.js';

function capture() {
	const published: Array<{ text: string; payload: Record<string, unknown> }> = [];
	const eb = {
		publish: (event: { text: string; payload: Record<string, unknown> }) => {
			published.push(event);
		},
	};
	return { eb, published };
}

describe('./announcements/fightConcludes.ts', () => {
	afterEach(() => sinon.restore());

	it('names a single winner — the fight log knew, the feed never said', () => {
		const { eb, published } = capture();

		announceFightConcludes(eb as never, 'Ring', {}, {
			deaths: 4,
			isDraw: false,
			rounds: 2,
			winners: [{ monsterName: 'Mamu', team: null }],
		});

		expect(published[0]!.text).to.include('🏆 Mamu wins!');
		expect(published[0]!.text).to.include('with 4 dead after 2 rounds!');
	});

	it('names the team when several contestants win together', () => {
		const { eb, published } = capture();

		announceFightConcludes(eb as never, 'Ring', {}, {
			deaths: 3,
			isDraw: false,
			rounds: 4,
			winners: [
				{ monsterName: 'Mamu', team: 'Alliance' },
				{ monsterName: 'Rivian', team: 'Alliance' },
			],
		});

		expect(published[0]!.text).to.include('🏆 Alliance wins! (Mamu, Rivian)');
	});

	it('lists winners individually when they are not on one team', () => {
		const { eb, published } = capture();

		announceFightConcludes(eb as never, 'Ring', {}, {
			deaths: 1,
			isDraw: false,
			rounds: 1,
			winners: [
				{ monsterName: 'Mamu', team: null },
				{ monsterName: 'Rivian', team: 'Alliance' },
			],
		});

		expect(published[0]!.text).to.include('🏆 Mamu, Rivian win!');
	});

	it('claims no winner for a draw', () => {
		const { eb, published } = capture();

		announceFightConcludes(eb as never, 'Ring', {}, {
			deaths: 0,
			isDraw: true,
			rounds: 10,
			winners: [],
		});

		expect(published[0]!.text).to.not.include('🏆');
		expect(published[0]!.text).to.include('in a draw after 10 rounds!');
	});

	it('omits the winner line when winners are absent entirely', () => {
		const { eb, published } = capture();

		announceFightConcludes(eb as never, 'Ring', {}, { deaths: 2, isDraw: false, rounds: 3 });

		expect(published[0]!.text).to.not.include('🏆');
		expect(published[0]!.text).to.include('with 2 dead after 3 rounds!');
	});

	it('uses the singular round word for a one-round fight', () => {
		const { eb, published } = capture();

		announceFightConcludes(eb as never, 'Ring', {}, {
			deaths: 1,
			isDraw: false,
			rounds: 1,
			winners: [{ monsterName: 'Mamu', team: null }],
		});

		expect(published[0]!.text).to.include('after 1 round!');
	});
});
