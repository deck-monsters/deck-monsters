import { expect } from 'chai';
import sinon from 'sinon';

import { FleeCard } from './flee.js';
import Basilisk from '../monsters/basilisk.js';

describe('./cards/flee.ts', () => {
	const ring: any = {
		channelManager: {
			sendMessages: sinon.stub().resolves(),
		},
	};

	it('can be instantiated with defaults', () => {
		const flee = new FleeCard();

		expect(flee).to.be.an.instanceof(FleeCard);
		expect(flee.icon).to.equal('🏃');
	});

	it('returns true if the player is not bloodied', () => {
		const flee = new FleeCard();

		const player = new Basilisk({ name: 'player' });
		const target = new Basilisk({ name: 'target' });

		return flee.play(player, target, ring, [{ monster: target }]).then(result =>
			expect(result).to.equal(true)
		);
	});

	it('returns false if the player flees', () => {
		const flee = new FleeCard();

		const checkSuccessStub = sinon.stub(flee, 'checkSuccess');
		checkSuccessStub.returns({ success: true } as any);

		const player = new Basilisk({ name: 'player' });
		const target = new Basilisk({ name: 'target' });

		(player as any).hp = 2;

		return flee.play(player, target, ring, [{ monster: target }]).then(result =>
			expect(result).to.equal(false)
		);
	});

	it('returns true if the player fails to flee', () => {
		const flee = new FleeCard();

		const checkSuccessStub = sinon.stub(flee, 'checkSuccess');
		checkSuccessStub.returns({ success: false } as any);

		const player = new Basilisk({ name: 'player' });
		const target = new Basilisk({ name: 'target' });

		(player as any).hp = 2;

		return flee.play(player, target, ring, [{ monster: target }]).then(result =>
			expect(result).to.equal(true)
		);
	});
});
