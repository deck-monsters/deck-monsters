import { expect } from 'chai';
import sinon from 'sinon';

import { PrionDiseaseCard } from './prion-disease.js';
import Basilisk from '../monsters/basilisk.js';

describe('./cards/prion-disease.ts', () => {
	it('can be instantiated with defaults', () => {
		const prionDisease = new PrionDiseaseCard();

		expect(prionDisease).to.be.an.instanceof(PrionDiseaseCard);
		expect(prionDisease.icon).to.equal('旦');
		expect(prionDisease.stats).to.equal(`Serve everyone a nice round of milkshakes!\nUsually restores between 0-3hp to each opponent, and 1-4hp for the player.\n1:50 chance to kill each opponent.\n1:100 chance to kill yourself.`);
	});

	it('can be played', () => {
		const prionDisease = new PrionDiseaseCard();

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

		const getHPModifierSpy = sinon.spy(prionDisease, 'getHPModifier');

		return prionDisease.play(player, target1, ring, ring.contestants).then(() => {
			getHPModifierSpy.restore();
			expect(getHPModifierSpy.callCount).to.equal(3);
		});
	});

	it('is only applied to active players', () => {
		const prionDisease = new PrionDiseaseCard();

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

		const getHPModifierSpy = sinon.spy(prionDisease, 'getHPModifier');

		const activeContestants = [
			{ character: {}, monster: player },
			{ character: {}, monster: target1 },
		];

		return prionDisease.play(player, target1, ring, activeContestants).then(() => {
			getHPModifierSpy.restore();
			expect(getHPModifierSpy.callCount).to.equal(2);
		});
	});

	it('randomly kills player when getHPModifier returns negative hp', () => {
		const prionDisease = new PrionDiseaseCard();
		const getHPModifierStub = sinon.stub(prionDisease, 'getHPModifier');
		getHPModifierStub.callsFake((_player: any, target: any) => -target.hp);

		const player = new Basilisk({ name: 'player' });
		const ring: any = {
			contestants: [{ character: {}, monster: player }],
		};

		const activeContestants = [{ character: {}, monster: player }];

		return prionDisease.play(player, player, ring, activeContestants).then(() => {
			getHPModifierStub.restore();
			expect((player as any).hp).to.equal(0);
		});
	});

	it('randomly heals player when getHPModifier returns positive', () => {
		const prionDisease = new PrionDiseaseCard();
		const getHPModifierStub = sinon.stub(prionDisease, 'getHPModifier');
		getHPModifierStub.returns(2);

		const player = new Basilisk({ name: 'player' });
		(player as any).hp = 1;
		const ring: any = {
			contestants: [{ character: {}, monster: player }],
		};

		const activeContestants = [{ character: {}, monster: player }];

		return prionDisease.play(player, player, ring, activeContestants).then(() => {
			getHPModifierStub.restore();
			expect((player as any).hp).to.equal(3);
		});
	});

	it('returns true if the target is not killed', () => {
		const prionDisease = new PrionDiseaseCard();

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

		const getHPModifierStub = sinon.stub(prionDisease, 'getHPModifier');
		getHPModifierStub.returns(0);

		return prionDisease.play(player, target1, ring, ring.contestants).then((fightContinues: any) => {
			getHPModifierStub.restore();
			expect(fightContinues).to.equal(true);
			expect(getHPModifierStub.callCount).to.equal(3);
		});
	});

	it('returns false if the target is killed', () => {
		const prionDisease = new PrionDiseaseCard();

		const player = new Basilisk({ name: 'player' });
		const target1 = new Basilisk({ name: 'target1' });
		const ring: any = {
			contestants: [
				{ character: {}, monster: player },
				{ character: {}, monster: target1 },
			],
		};

		const getHPModifierStub = sinon.stub(prionDisease, 'getHPModifier');
		getHPModifierStub.returns(-1000);

		return prionDisease.play(player, target1, ring, ring.contestants).then((fightContinues: any) => {
			getHPModifierStub.restore();
			expect(fightContinues).to.equal(false);
			expect(getHPModifierStub.callCount).to.equal(2);
		});
	});

	it('has hit flavors', () => {
		const prionDisease = new PrionDiseaseCard();

		expect((prionDisease as any).flavors.hits).to.be.an('array');
	});
});
