import { expect } from 'chai';

import { reviveAnnouncement } from './revive-message.js';
import { PRONOUNS } from '../../helpers/pronouns.js';

const monster = (over: Record<string, unknown> = {}) => ({
	givenName: 'Rex',
	pronouns: PRONOUNS.male,
	displayLevel: 'beginner',
	...over,
});

describe('./characters/helpers/revive-message.ts', () => {
	it('says a beginner returns right away, with 1 HP, and that monsters heal while resting', () => {
		expect(reviveAnnouncement(monster(), Date.now())).to.equal(
			'Rex has begun to revive. He is a beginner monster, so he comes back right away, with 1 HP. Monsters heal a little at a time while they rest.',
		);
	});

	it('says "in about {time}" above beginner, without doubling "in"', () => {
		const began = Date.now();
		const text = reviveAnnouncement(
			monster({ displayLevel: 'level 2', respawnTimeoutLength: 5 * 60 * 1000, respawnTimeoutBegan: began }),
			began + 5 * 60 * 1000,
		);
		expect(text).to.include('so he comes back in about 5 minutes, with 1 HP.');
		expect(text).to.not.include('in about in');
	});

	it('agrees the verbs for they/them monsters', () => {
		const text = reviveAnnouncement(monster({ pronouns: PRONOUNS.androgynous }), Date.now());
		expect(text).to.include('They are a beginner monster, so they come back right away');
	});
});
