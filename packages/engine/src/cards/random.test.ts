import { expect } from 'chai';
import sinon from 'sinon';

import { RandomCard, randomCardHelpers } from './random.js';
import { TestCard } from './test.js';
import Basilisk from '../monsters/basilisk.js';

describe('./cards/random.ts', () => {
	let drawStub: sinon.SinonStub;

	before(() => {
		drawStub = sinon.stub();
		randomCardHelpers.draw = drawStub as any;
	});

	beforeEach(() => {
		drawStub.returns(new TestCard());
	});

	afterEach(() => {
		drawStub.reset();
	});

	after(() => {
		randomCardHelpers.draw = undefined;
	});

	it('can be instantiated with defaults', () => {
		const random = new RandomCard();

		expect(random).to.be.an.instanceof(RandomCard);
	});

	it('draws and plays another card', () => {
		const random = new RandomCard();

		const player = new Basilisk({ name: 'player' });
		const target = new Basilisk({ name: 'target' });

		return random.play(player, target).then(() => {
			expect(drawStub.callCount).to.equal(1);
			expect(drawStub.firstCall.args[0]).to.deep.equal(random.options as any);
			expect(drawStub.firstCall.args[1]).to.equal(player);
			expect((player as any).played).to.equal(1);
			expect((target as any).targeted).to.equal(1);
		});
	});
});
