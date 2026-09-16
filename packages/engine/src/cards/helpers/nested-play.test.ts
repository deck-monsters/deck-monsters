import { expect } from 'chai';
import sinon from 'sinon';

import { playNestedCard } from './nested-play.js';
import { RandomCard, randomCardHelpers } from '../random.js';
import { TestCard } from '../test.js';
import Basilisk from '../../monsters/basilisk.js';

describe('./cards/helpers/nested-play.ts', () => {
	afterEach(() => sinon.restore());

	it('plays the nested card with the outer play’s target and ring context', async () => {
		const play = sinon.stub().resolves('played');
		const player = new Basilisk({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const ring = { id: 'ring' };
		const contestants = [{ monster: player }];

		const result = await playNestedCard({
			card: { play },
			player,
			proposedTarget: target,
			ring,
			activeContestants: contestants,
		});

		expect(result).to.equal('played');
		expect(play.calledOnceWith(player, target, ring, contestants)).to.equal(true);
	});

	it('emits the narration before the nested card is played', async () => {
		const order: string[] = [];
		const play = sinon.stub().callsFake(() => {
			order.push('play');
			return Promise.resolve(true);
		});
		const emit = sinon.stub().callsFake((event: string) => order.push(`emit:${event}`));

		await playNestedCard({
			card: { play },
			player: new Basilisk({ name: 'player' }),
			narration: 'something happens',
			emit: emit as never,
		});

		expect(order).to.deep.equal(['emit:narration', 'play']);
		expect(emit.firstCall.args[1]).to.deep.equal({ narration: 'something happens' });
	});

	it('does not emit a narration when the caller already narrated', async () => {
		const emit = sinon.stub();

		await playNestedCard({
			card: { play: sinon.stub().resolves(true) },
			player: new Basilisk({ name: 'player' }),
			emit: emit as never,
		});

		expect(emit.called).to.equal(false);
	});

	it('resolves without a real timer in skip mode so tests and the harness stay fast', async () => {
		// DECK_MONSTERS_SKIP_DELAYS is set for the engine test run; a nested play must
		// not introduce a wall-clock delay under it.
		const started = Date.now();
		await playNestedCard({
			card: { play: sinon.stub().resolves(true) },
			player: new Basilisk({ name: 'player' }),
		});
		expect(Date.now() - started).to.be.lessThan(50);
	});

	it('Random Play narrates the chain so it does not read as a second turn', async () => {
		const drawStub = sinon.stub().returns(new TestCard());
		const previous = randomCardHelpers.draw;
		randomCardHelpers.draw = drawStub as never;

		try {
			const random = new RandomCard();
			const player = new Basilisk({ name: 'Rivian' });
			const narrations: string[] = [];
			const emitSpy = sinon.stub(random, 'emit').callsFake(((event: string, payload: { narration?: string }) => {
				if (event === 'narration' && payload?.narration) narrations.push(payload.narration);
			}) as never);

			await random.play(player, new Basilisk({ name: 'target' }));

			expect(emitSpy.calledWith('played')).to.equal(true);
			expect(narrations).to.have.lengthOf(1);
			expect(narrations[0]).to.include('Rivian');
		} finally {
			randomCardHelpers.draw = previous;
		}
	});
});
