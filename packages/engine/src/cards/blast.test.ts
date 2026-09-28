import { scaledCasterLevel } from './blast.js';
import { expect } from 'chai';

import { BlastCard } from './blast.js';
import Basilisk from '../monsters/basilisk.js';

describe('./cards/blast.ts', () => {
	it('can be instantiated with defaults', () => {
		const blast = new BlastCard();

		expect(blast).to.be.an.instanceof(BlastCard);
		expect(blast.stats).to.equal('Blast: 3 base damage +1 per level of the caster (per two levels past level 10)');
	});

	it('can be instantiated with options', () => {
		const blast = new BlastCard({ damage: 10, levelDamage: 2 } as any);

		expect(blast).to.be.an.instanceof(BlastCard);
		expect(blast.stats).to.equal('Blast: 10 base damage +2 per level of the caster (per two levels past level 10)');
	});

	it('can be played', () => {
		const blast = new BlastCard({ damage: 4, levelDamage: 2 } as any);

		const player = new Basilisk({ name: 'player' });
		const target1 = new Basilisk({ name: 'target1' });
		const target2 = new Basilisk({ name: 'target2' });
		const ring: any = {
			contestants: [
				{ character: {}, monster: player },
				{ character: {}, monster: target1 },
				{ character: {}, monster: target2 },
			],
		};

		const playerStartingHp = (player as any).hp;
		const playerLevel = (player as any).level;
		const damage = 4 + 2 * playerLevel;
		const target1StartingHp = (target1 as any).hp;
		const target2StartingHp = (target2 as any).hp;

		return blast.play(player, target1, ring, ring.contestants).then(() => {
			expect((player as any).hp).to.equal(playerStartingHp);
			expect((target1 as any).hp).to.equal(target1StartingHp - damage);
			expect((target2 as any).hp).to.equal(target2StartingHp - damage);
		});
	});

	it('is only applied to active players', () => {
		const blast = new BlastCard({ damage: 4, levelDamage: 2 } as any);

		const player = new Basilisk({ name: 'player' });
		const target1 = new Basilisk({ name: 'target1' });
		const target2 = new Basilisk({ name: 'target2' });
		const ring: any = {
			contestants: [
				{ character: {}, monster: player },
				{ character: {}, monster: target1 },
				{ character: {}, monster: target2 },
			],
		};
		const activeContestants = [
			{ character: {}, monster: player },
			{ character: {}, monster: target1 },
		];

		const playerStartingHp = (player as any).hp;
		const playerLevel = (player as any).level;
		const damage = 4 + 2 * playerLevel;
		const target1StartingHp = (target1 as any).hp;
		const target2StartingHp = (target2 as any).hp;

		return blast.play(player, target1, ring, activeContestants).then(() => {
			expect((player as any).hp).to.equal(playerStartingHp);
			expect((target1 as any).hp).to.equal(target1StartingHp - damage);
			expect((target2 as any).hp).to.equal(target2StartingHp);
		});
	});

	it('returns true if the target is not killed', () => {
		const blast = new BlastCard({ damage: 4, levelDamage: 2 } as any);

		const player = new Basilisk({ name: 'player' });
		const targetMonster = new Basilisk({ name: 'target' });
		(targetMonster as any).hp = 99;

		const target: any = { character: {}, monster: targetMonster };
		const ring: any = {
			contestants: [{ character: {}, monster: player }, target],
		};

		return blast.play(player, targetMonster, ring, ring.contestants).then(fightContinues => {
			expect(fightContinues).to.equal(true);
		});
	});

	it('returns false if the target is killed', () => {
		const blast = new BlastCard({ damage: 4, levelDamage: 2 } as any);

		const player = new Basilisk({ name: 'player' });
		(player as any).encounter = {};
		const targetMonster = new Basilisk({ name: 'target' });
		(targetMonster as any).hp = 1;

		const target: any = { character: {}, monster: targetMonster };
		const ring: any = {
			contestants: [{ character: {}, monster: player }, target],
		};

		return blast.play(player, targetMonster, ring, ring.contestants).then(fightContinues => {
			expect(fightContinues).to.equal(false);
		});
	});

	it('has hit flavors', () => {
		const blast = new BlastCard();

		expect((blast as any).flavors.hits).to.be.an('array');
	});
	it('scales by every caster level up to 10, then by one per two levels', () => {
		// At +1 a level, level 15 Blast out-hit a Hit by 60% to every opponent (Pass C, plan 32).
		expect(scaledCasterLevel(0)).to.equal(0);
		expect(scaledCasterLevel(5)).to.equal(5);
		expect(scaledCasterLevel(10)).to.equal(10);
		expect(scaledCasterLevel(11)).to.equal(10);
		expect(scaledCasterLevel(15)).to.equal(12);
		expect(scaledCasterLevel(20)).to.equal(15);
	});

	it('deals base damage plus the scaled caster level', async () => {
		const blast = new BlastCard();
		let dealt = 0;
		const target = { hit: (damage: number) => { dealt = damage; return Promise.resolve(true); } };
		await blast.effect({ level: 15 } as never, target as never);
		expect(dealt).to.equal(3 + 12);
	});
});
