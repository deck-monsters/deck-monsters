import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect } from 'chai';

import { publicDisplayName } from './public-display-name.js';

/**
 * `profiles.display_name` is seeded from the user's email by the `handle_new_user` trigger
 * (see docs/roadmap/10-bug-fixes.md), so any player who never set a name has their address
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
		expect(
			calls.length,
			'expected publicDisplayName at all four leaderboard name sites',
		).to.equal(4);
	});

	it('imports the masker rather than reimplementing it', () => {
		const src = readFileSync(join(process.cwd(), 'src/analytics-queries.ts'), 'utf8');
		expect(src).to.include("from './public-display-name.js'");
	});
});
