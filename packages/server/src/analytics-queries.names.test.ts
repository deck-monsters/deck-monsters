import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect } from 'chai';

import { maskFightParticipants, type FightParticipant } from './analytics-queries.js';
import { publicDisplayName } from './public-display-name.js';

/**
 * `profiles.display_name` is seeded from the user's email by the `handle_new_user` trigger
 * (see docs/roadmap/10b-bugs-fixed.md #95), so any player who never set a name has their address
 * sitting in that column. `getDisplayName` in RoomManager masks it on the way into the
 * game, but the leaderboard queries read `profiles.display_name` straight out of the
 * database — and a leaderboard is shown to every member of the room, which makes it the
 * widest audience any name reaches.
 *
 * This pins the masking contract that `analytics-queries.ts` now applies at each of its
 * four name-returning sites. See 10b-bugs-fixed.md #112.
 */
describe('leaderboard display names are masked before they leave the server', () => {
	it('reduces an email to its local part', () => {
		expect(publicDisplayName('david+leyo@brainermail.com')).to.equal('david');
	});

	it('drops the plus-address suffix, which is itself identifying', () => {
		expect(publicDisplayName('someone+deckmonsters@example.com')).to.not.include('+');
	});

	it('leaves a real display name untouched', () => {
		expect(publicDisplayName('Santi Brainer')).to.equal('Santi Brainer');
	});

	it('leaves a handle that merely contains @ alone', () => {
		expect(publicDisplayName('@stary')).to.equal('@stary');
	});

	it('never returns an empty label', () => {
		expect(publicDisplayName('')).to.equal('Player');
	});
});

describe('analytics-queries applies the mask at every name site', () => {
	it('masks at all four sites, not just the room player board', () => {
		// A source-level count, deliberately. The failure mode is a *missing* call at one of
		// four separate queries — room players, room monsters' owners, global players,
		// global monsters' owners — and a behavioural test would only catch the one query it
		// happened to cover. Note the two `displayName: r.displayName` reads that remain are
		// MONSTER names, which are player-chosen and must not be masked.
		const src = readFileSync(join(process.cwd(), 'src/analytics-queries.ts'), 'utf8');
		const calls = src.match(/publicDisplayName\(/g) ?? [];
		// Five, not four: the fifth is `maskFightParticipants`, which covers the four fight
		// queries that leaked the same emails through `participants[].ownerDisplayName`
		// (#117) — a site the #112 fix missed precisely because this count stopped at the
		// leaderboards.
		expect(
			calls.length,
			'expected publicDisplayName at the four leaderboard name sites plus the fight-participant masker',
		).to.equal(5);
	});

	it('imports the masker rather than reimplementing it', () => {
		const src = readFileSync(join(process.cwd(), 'src/analytics-queries.ts'), 'utf8');
		expect(src).to.include("from './public-display-name.js'");
	});
});

describe('room leaderboard live-name override', () => {
	it('sanitizes the restored character name before it can replace the safe query value', () => {
		const src = readFileSync(join(process.cwd(), 'src/trpc/router.ts'), 'utf8');
		expect(src).to.include("import { publicDisplayName } from '../public-display-name.js'");
		expect(src).to.match(
			/displayName:\s*publicDisplayName\(\s*String\(game\.characters\?\.\[r\.userId\]\?\.givenName \?\? r\.displayName\)/,
		);
	});
});

/**
 * The engine writes `participants[].ownerDisplayName` from `character.givenName`, so a
 * player who never chose a name has their email inside every fight row — and fight rows go
 * to every member of the room through the fight log and the catch-up payload. No component
 * renders the field today, which is exactly why it survived the #112 sweep. See
 * 10b-bugs-fixed.md #117.
 */
describe('fight participants are masked before they leave the server', () => {
	const row = (owner: string) => ({
		fightNumber: 1,
		participants: [
			{ monsterId: 'm1', monsterName: 'Stonefang', ownerDisplayName: owner } as FightParticipant,
		],
	});

	it('masks an email owner name', () => {
		expect(maskFightParticipants(row('david+leyo@brainermail.com')).participants[0]!.ownerDisplayName).to.equal(
			'david',
		);
	});

	it('leaves the monster name alone — those are player-chosen', () => {
		expect(maskFightParticipants(row('dave@example.com')).participants[0]!.monsterName).to.equal('Stonefang');
	});

	it('does not mutate the row it was given', () => {
		const original = row('dave@example.com');
		maskFightParticipants(original);
		expect(original.participants[0]!.ownerDisplayName).to.equal('dave@example.com');
	});

	it('survives a row whose participants column is not an array', () => {
		const broken = { participants: null } as unknown as { participants: FightParticipant[] };
		expect(() => maskFightParticipants(broken)).to.not.throw();
	});
});
