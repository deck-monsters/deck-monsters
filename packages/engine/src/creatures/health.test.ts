import { expect } from 'chai';
import sinon from 'sinon';

import { TIME_TO_HEAL_MS, TIME_TO_RESURRECT_MS } from '../constants/timing.js';
import Jinn from '../monsters/jinn.js';

describe('wall-clock health recovery', () => {
	it('catches up passive healing after a room was unloaded', () => {
		const now = Date.now();
		const monster = new Jinn({ hp: 1, hpUpdatedAt: now - (5 * TIME_TO_HEAL_MS) });
		try {
			expect(monster.hp).to.equal(6);
		} finally {
			monster.disposeTimers();
		}
	});

	it('catches up healing since an overdue revival while the host was asleep', () => {
		const clock = sinon.useFakeTimers({ now: new Date('2030-01-01T00:00:00Z') });
		const began = Date.now() - TIME_TO_RESURRECT_MS - (5 * TIME_TO_HEAL_MS);
		const monster = new Jinn({ hp: 0, xp: 51, respawnTimeoutBegan: began });
		try {
			clock.tick(0);
			expect(monster.hp).to.equal(6);
			expect(monster.respawnTimeoutBegan).to.equal(0);
		} finally {
			monster.disposeTimers();
			clock.restore();
		}
	});

	it('does not heal a defeated monster before its revival time', () => {
		const now = Date.now();
		const monster = new Jinn({ hp: 0, hpUpdatedAt: now - (20 * TIME_TO_HEAL_MS) });
		try {
			expect(monster.hp).to.equal(0);
		} finally {
			monster.disposeTimers();
		}
	});
});
