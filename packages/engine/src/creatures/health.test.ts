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

	it('does not bank combat time as passive healing', () => {
		const clock = sinon.useFakeTimers();
		const monster = new Jinn({ hp: 5, hpUpdatedAt: Date.now() });
		try {
			monster.startEncounter({});
			clock.tick(5 * TIME_TO_HEAL_MS);
			monster.endEncounter();
			clock.tick(TIME_TO_HEAL_MS);
			expect(monster.hp).to.equal(6);
		} finally {
			monster.disposeTimers();
			clock.restore();
		}
	});

	it('does not bank time spent at full health for a later level-up', () => {
		const clock = sinon.useFakeTimers();
		const monster = new Jinn();
		try {
			const fullHp = monster.hp;
			clock.tick(20 * TIME_TO_HEAL_MS);
			monster.xp = 51;
			expect(monster.maxHp).to.be.greaterThan(fullHp);
			expect(monster.applyPassiveHealing()).to.equal(0);
			expect(monster.hp).to.equal(fullHp);
		} finally {
			monster.disposeTimers();
			clock.restore();
		}
	});

	it('starts immediate-revival healing when the item revives the monster', () => {
		const clock = sinon.useFakeTimers();
		const monster = new Jinn({ hp: 0, xp: 51 });
		try {
			monster.respawn();
			clock.tick(5 * 60_000);
			monster.respawn(true);
			clock.tick(0);
			expect(monster.hp).to.equal(1);
		} finally {
			monster.disposeTimers();
			clock.restore();
		}
	});
});
