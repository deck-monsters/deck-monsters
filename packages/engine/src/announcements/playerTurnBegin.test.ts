import { expect } from 'chai';

import { announceTurnBegin } from './playerTurnBegin.js';
import { monsterTurnLine } from '../helpers/card.js';

function capture() {
	const published: Array<{ text: string }> = [];
	return {
		eb: { publish: (event: { text: string }) => published.push(event) },
		published,
	};
}

function makeContestant() {
	return {
		character: { givenName: 'Santi Brainer', identity: '🧙 Santi Brainer' },
		monster: {
			icon: '🐍',
			givenName: 'Killer Killer',
			individualDescription: 'A powerful, gold, desert-dwelling basilisk.',
			stats: 'Type: Basilisk\nClass: Barbarian\n\nac: 7 | hp: 35/35\ndex: 4 | str: 7 | int: 6',
			rankings: 'Battles fought: 0\nBattles won: 0',
			hp: 30,
			maxHp: 35,
			ac: 7,
			displayLevel: 'beginner',
		},
		lastMonsterPlayed: undefined as unknown,
		team: undefined as string | undefined,
	};
}

const lineCount = (text: string) => text.trim().split('\n').filter(l => l.trim()).length;

describe('./announcements/playerTurnBegin.ts', () => {
	it('prints the full monster card the first time a monster acts', () => {
		const { eb, published } = capture();
		const contestant = makeContestant();

		announceTurnBegin(eb as never, 'Ring', {}, { contestant });

		const text = published[0]!.text;
		expect(text).to.include("It's Santi Brainer's turn.");
		expect(text).to.include('plays the following monster:');
		// formatCard wraps at 32 chars, so assert on fragments that survive wrapping.
		expect(text).to.include('powerful');
		expect(text).to.include('Battles fought: 0');
	});

	it('collapses to a one-line summary on a repeat turn', () => {
		// The old "short" form was not shorter: formatCard only swapped which of
		// description/stats it rendered, so a repeat still printed the whole stat block.
		// Measured across 8 fights, turn banners were 47% of every line in the feed.
		const { eb, published } = capture();
		const contestant = makeContestant();

		announceTurnBegin(eb as never, 'Ring', {}, { contestant });
		announceTurnBegin(eb as never, 'Ring', {}, { contestant });

		const first = published[0]!.text;
		const repeat = published[1]!.text;

		expect(lineCount(repeat)).to.be.lessThan(lineCount(first));
		expect(lineCount(repeat)).to.be.at.most(3);
		expect(repeat).to.include("It's Santi Brainer's turn.");
		expect(repeat).to.not.include('plays the following monster:');
	});

	it('keeps the values that change on a repeat turn', () => {
		const { eb, published } = capture();
		const contestant = makeContestant();

		announceTurnBegin(eb as never, 'Ring', {}, { contestant });
		contestant.monster.hp = 12;
		announceTurnBegin(eb as never, 'Ring', {}, { contestant });

		// hp and ac are the only live values in the stat block; Discord players have no
		// roster panel and read current hp here.
		expect(published[1]!.text).to.include('12/35 hp');
		expect(published[1]!.text).to.include('ac 7');
		expect(published[1]!.text).to.include('Killer Killer');
	});

	it('prints the full card again when the contestant switches monster', () => {
		const { eb, published } = capture();
		const contestant = makeContestant();

		announceTurnBegin(eb as never, 'Ring', {}, { contestant });
		contestant.monster = { ...contestant.monster, givenName: 'Wolf Fang' };
		announceTurnBegin(eb as never, 'Ring', {}, { contestant });

		expect(published[1]!.text).to.include('plays the following monster:');
	});

	it('shows the team on a repeat turn when a ring event assigned one', () => {
		const { eb, published } = capture();
		const contestant = makeContestant();
		contestant.team = 'Alliance';

		announceTurnBegin(eb as never, 'Ring', {}, { contestant });
		announceTurnBegin(eb as never, 'Ring', {}, { contestant });

		expect(published[1]!.text).to.include('Alliance');
	});
});

describe('./helpers/card.ts monsterTurnLine', () => {
	it('renders name, live hp, ac and level on one line', () => {
		const line = monsterTurnLine({
			icon: '🐍',
			givenName: 'Killer Killer',
			hp: 30,
			maxHp: 35,
			ac: 7,
			displayLevel: 'beginner',
		});

		expect(lineCount(line)).to.equal(1);
		expect(line).to.equal('🐍 Killer Killer — 30/35 hp · ac 7 · beginner');
	});

	it('omits fields a partially hydrated monster is missing', () => {
		const line = monsterTurnLine({ icon: '🐍', givenName: 'Killer Killer' });
		expect(line).to.equal('🐍 Killer Killer');
	});
});
