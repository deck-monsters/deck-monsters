import { expect } from 'chai';
import sinon from 'sinon';

import { BasicShieldCard } from './basic-shield.js';
import Gladiator from '../monsters/gladiator.js';
import { pauseHelpers } from '../helpers/pause.js';

describe('./cards/basic-shield.ts', () => {
	let pauseStub: sinon.SinonStub;

	before(() => {
		pauseStub = sinon.stub(pauseHelpers, 'getThrottleRate');
		pauseStub.returns(5);
	});

	after(() => {
		pauseStub.restore();
	});

	it('can be instantiated with defaults', () => {
		const basicShield = new BasicShieldCard();

		expect(basicShield).to.be.an.instanceof(BasicShieldCard);
		expect(basicShield.icon).to.equal('🛡');
		expect((basicShield as any).boostAmount).to.equal(2);
		expect((basicShield as any).boostedProp).to.equal('ac');
		expect(basicShield.stats).to.equal(
			'Boost: ac +2 (max boost of level * 2, or 1 for beginner, then boost granted to hp instead).\nIf hit by melee attack, damage comes out of ac boost first.'
		);
	});

	it('increases ac', () => {
		const basicShield = new BasicShieldCard();

		const player = new Gladiator({ name: 'player' });
		const before = (player as any).ac;

		return basicShield.play(player).then(result => {
			expect(result).to.equal(true);
			expect((player as any).ac).to.be.above(before);
		});
	});
});
