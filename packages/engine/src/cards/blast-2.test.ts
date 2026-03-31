import { expect } from 'chai';

import { Blast2Card } from './blast-2.js';
import Basilisk from '../monsters/basilisk.js';

describe('./cards/blast-2.ts', () => {
	it('can be instantiated with defaults', () => {
		const blast = new Blast2Card();

		expect(blast).to.be.an.instanceof(Blast2Card);
		expect(blast.stats).to.equal('Blast II: 3 base damage + int bonus of caster');
	});

	it('can be instantiated with options', () => {
		const blast = new Blast2Card({ damage: 10 } as any);

		expect(blast).to.be.an.instanceof(Blast2Card);
		expect(blast.stats).to.equal('Blast II: 10 base damage + int bonus of caster');
	});

	it('can be played', () => {
		const blast = new Blast2Card();

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
		const damage = 3 + (player as any).intModifier;
		const target1StartingHp = (target1 as any).hp;
		const target2StartingHp = (target2 as any).hp;

		return blast.play(player, target1, ring, ring.contestants).then(() => {
			expect((player as any).hp).to.equal(playerStartingHp);
			expect((target1 as any).hp).to.equal(target1StartingHp - damage);
			expect((target2 as any).hp).to.equal(target2StartingHp - damage);
		});
	});

	it('is only applied to active players', () => {
		const blast = new Blast2Card();

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
		const damage = 3 + (player as any).intModifier;
		const target1StartingHp = (target1 as any).hp;
		const target2StartingHp = (target2 as any).hp;

		return blast.play(player, target1, ring, activeContestants).then(() => {
			expect((player as any).hp).to.equal(playerStartingHp);
			expect((target1 as any).hp).to.equal(target1StartingHp - damage);
			expect((target2 as any).hp).to.equal(target2StartingHp);
		});
	});

	it('has hit flavors', () => {
		const blast = new Blast2Card();

		expect((blast as any).flavors.hits).to.be.an('array');
	});
});
