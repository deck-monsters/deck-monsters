import { expect } from 'chai';

import { announceModifier } from './modifier.js';

const announce = (monster: Record<string, unknown>, opts: Parameters<typeof announceModifier>[3]): string => {
	const published: Array<{ text: string }> = [];
	const eb = { publish: (event: { text: string }) => published.push(event) };
	announceModifier(eb as never, '', { pronouns: { his: 'his' }, modifiers: {}, ...monster }, opts);
	return published[0]!.text;
};

describe('./announcements/modifier.ts', () => {
	it('says a penalty has ended, with no dangling "total" (owner screenshot, 2026-10-12)', () => {
		const text = announce(
			{ identity: '🐉 Ralarth', givenName: 'Ralarth', ac: 9, encounterModifiers: { ac: 0 } },
			{ amount: 2, attr: 'ac', prevValue: 7 },
		);
		expect(text).to.equal("🐉 Ralarth's ac is back to 9 (increased by 2)");
	});

	it('keeps the running total when one is still in force', () => {
		const text = announce(
			{ identity: '🐉 Ralarth', givenName: 'Ralarth', ac: 11, encounterModifiers: { ac: 3 } },
			{ amount: 2, attr: 'ac', prevValue: 9 },
		);
		expect(text).to.equal("🐉 Ralarth's ac is now 11 (increased by 2, +3 total)");
	});

	it('says when an xp drain drops the monster a level', () => {
		// 113 xp is level 3, 101 is level 2 (helpers/levels.test.ts).
		const text = announce(
			{ identity: '🐦 Queen', givenName: 'Queen', xp: 101, level: 2, encounterModifiers: { xp: -12 } },
			{ amount: -12, attr: 'xp', prevValue: 113 },
		);
		expect(text).to.match(/Queen drops to level 2 for this fight\.$/);
	});

	it('says nothing about level when the xp change keeps the level', () => {
		const text = announce(
			{ identity: '🐦 Queen', givenName: 'Queen', xp: 120, level: 3, encounterModifiers: { xp: 7 } },
			{ amount: 7, attr: 'xp', prevValue: 113 },
		);
		expect(text).to.not.include('level');
	});
});
