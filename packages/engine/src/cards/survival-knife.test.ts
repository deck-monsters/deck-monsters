import { expect } from 'chai';
import sinon from 'sinon';

import { SurvivalKnifeCard } from './survival-knife.js';
import Basilisk from '../monsters/basilisk.js';
import { HitCard } from './hit.js';
import { HealCard } from './heal.js';
import { FIGHTER } from '../constants/creature-classes.js';

describe('./cards/survival-knife.ts', () => {
	it('can be instantiated with defaults', () => {
		const survivalKnife = new SurvivalKnifeCard();
		const hit = new HitCard({ damageDice: (survivalKnife as any).damageDice } as any);
		const heal = new HealCard({ healthDice: (survivalKnife as any).damageDice } as any);

		expect(survivalKnife).to.be.an.instanceof(SurvivalKnifeCard);
		expect(survivalKnife.stats).to.equal(`${hit.stats}\n- or, below 1/4 health -\n${heal.stats}`);
		expect((survivalKnife as any).permittedClassesAndTypes).to.deep.equal([FIGHTER]);
		expect(survivalKnife.icon).to.equal('🗡');
		expect((survivalKnife as any).damageDice).to.equal('2d4');
	});

	it('can be instantiated with options', () => {
		const survivalKnife = new SurvivalKnifeCard({ icon: '🤷‍♂️', damageDice: '1d4' } as any);
		const hit = new HitCard({ damageDice: (survivalKnife as any).damageDice } as any);
		const heal = new HealCard({ healthDice: (survivalKnife as any).damageDice } as any);

		expect(survivalKnife).to.be.an.instanceof(SurvivalKnifeCard);
		expect(survivalKnife.stats).to.equal(`${hit.stats}\n- or, below 1/4 health -\n${heal.stats}`);
		expect((survivalKnife as any).permittedClassesAndTypes).to.deep.equal([FIGHTER]);
		expect(survivalKnife.icon).to.equal('🤷‍♂️');
		expect((survivalKnife as any).damageDice).to.equal('1d4');
	});

	it('can be played when at full health', () => {
		const survivalKnife = new SurvivalKnifeCard();

		const player = new Basilisk({ name: 'player' });
		const target = new Basilisk({ name: 'target' });

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		const healEffectSpy = sinon.spy((survivalKnife as any).healCard, 'effect');

		return survivalKnife.play(player, target, ring, ring.contestants).then((result: any) => {
			expect(result).to.equal(true);
			expect(healEffectSpy.callCount).to.equal(0);
			healEffectSpy.restore();
		});
	});

	it('can be played when at low health', () => {
		const survivalKnife = new SurvivalKnifeCard();

		const player = new Basilisk({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		(player as any).hp = 1;

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		const healEffectSpy = sinon.spy((survivalKnife as any).healCard, 'effect');

		return survivalKnife
			.play(player, target, ring, ring.contestants)
			.then(() => {
				expect((player as any).hp).to.be.above(1);
				expect(healEffectSpy.callCount).to.equal(1);
			})
			.then(() => healEffectSpy.restore());
	});
});
