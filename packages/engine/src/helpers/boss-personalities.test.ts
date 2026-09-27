import { expect } from 'chai';

import { BOSS_PERSONALITIES, bossPersonalityFor } from './boss-personalities.js';
import { getTarget } from './targeting-strategies.js';
import { randomContestant } from './bosses.js';
import { helpersReady } from '../characters/helpers/random.js';
import PRONOUNS from './pronouns.js';

describe('helpers/boss-personalities.ts', () => {
	before(async () => {
		await helpersReady;
	});

	it('gives every boss one of the temperaments', () => {
		const strategies = new Set(BOSS_PERSONALITIES.map(p => p.strategy));
		for (let i = 0; i < 20; i += 1) {
			const boss = randomContestant();
			expect(strategies.has(boss.monster.targetingStrategy as string)).to.equal(true);
		}
	});

	it('reads each temperament aloud with he, she, and they', () => {
		for (const personality of BOSS_PERSONALITIES) {
			for (const pronouns of Object.values(PRONOUNS)) {
				const line = personality.temperament(pronouns);
				expect(line).to.match(/^[A-Z].*\.$/);
			}
		}
		expect(bossPersonalityFor(BOSS_PERSONALITIES[0]!.strategy)).to.equal(BOSS_PERSONALITIES[0]);
		expect(BOSS_PERSONALITIES[2]!.temperament(PRONOUNS.androgynous)).to.equal('They never forget who hit them last.');
	});

	it('never sends a boss after another boss while a challenger is in the ring', () => {
		for (const personality of BOSS_PERSONALITIES) {
			for (let i = 0; i < 10; i += 1) {
				const bossA = randomContestant();
				const bossB = randomContestant();
				const human = randomContestant({ isBoss: false });
				const contestants = [bossA, bossB, human];
				const target = getTarget({ contestants, playerContestant: bossA, strategy: personality.strategy }) as any;
				expect(target, personality.id).to.equal(human);
			}
		}
	});
});
