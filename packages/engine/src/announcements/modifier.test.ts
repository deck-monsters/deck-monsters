import { expect } from 'chai';

import { announceModifier } from './modifier.js';

let lastPayload: Record<string, unknown> = {};
const announce = (monster: Record<string, unknown>, opts: Parameters<typeof announceModifier>[3]): string => {
	const published: Array<{ text: string; payload: Record<string, unknown> }> = [];
	const eb = { publish: (event: { text: string; payload: Record<string, unknown> }) => published.push(event) };
	announceModifier(eb as never, '', { pronouns: { his: 'his' }, modifiers: {}, ...monster }, opts);
	lastPayload = published[0]!.payload;
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
		// A first-time note explains why a level can move mid-fight (apps/web mechanic-notes).
		expect(lastPayload.mechanic).to.equal('fight-level');
	});

	it('says Beginner, not level 0, and leaves "for this fight" off a permanent change', () => {
		const text = announce(
			{ identity: '🐦 Queen', givenName: 'Queen', xp: 10, level: 0, encounterModifiers: {}, modifiers: { xp: -40 } },
			{ amount: -40, attr: 'xp', prevValue: 50, permanent: true },
		);
		expect(text).to.match(/Queen drops to Beginner\.$/);
	});

	it('says nothing about level when the xp change keeps the level', () => {
		const text = announce(
			{ identity: '🐦 Queen', givenName: 'Queen', xp: 120, level: 3, encounterModifiers: { xp: 7 } },
			{ amount: 7, attr: 'xp', prevValue: 113 },
		);
		expect(text).to.not.include('level');
		expect(lastPayload.mechanic).to.equal(undefined);
	});
});
