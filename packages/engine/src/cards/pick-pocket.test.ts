import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';

chaiUse(chaiAsPromised);

import { randomCharacter } from '../characters/index.js';
import { randomContestant } from '../helpers/bosses.js';
import { DestroyCard } from './destroy.js';
import { PickPocketCard } from './pick-pocket.js';
import Gladiator from '../monsters/gladiator.js';
import * as allCards from './helpers/all.js';
import { randomHelpers } from '../helpers/random.js';
import { eachSeries } from '../helpers/promise.js';

describe('./cards/pick-pocket.ts', () => {
	let sampleStub: sinon.SinonStub;

	before(() => {
		sampleStub = sinon.stub(randomHelpers, 'sample');
	});

	beforeEach(() => {
		sampleStub.callsFake((arr: any[]) => arr[Math.floor(Math.random() * arr.length)]);
	});

	afterEach(() => {
		sampleStub.reset();
	});

	after(() => {
		sampleStub.restore();
	});

	it('can be instantiated with defaults', () => {
		const pickPocket = new PickPocketCard();

		expect(pickPocket).to.be.an.instanceof(PickPocketCard);
	});

	it('finds the player with the highest xp', () => {
		const pickPocket = new PickPocketCard();

		const playerCharacter = randomCharacter();
		const player = playerCharacter.monsters[0];
		const target1Character = randomCharacter();
		const target1 = target1Character.monsters[0];
		const target2Character = randomCharacter();
		const target2 = target2Character.monsters[0];
		const target3Character = randomCharacter();
		const target3 = target3Character.monsters[0];

		const ring: any = {
			contestants: [
				{ character: playerCharacter, monster: player },
				{ character: target1Character, monster: target1 },
				{ character: target2Character, monster: target2 },
				{ character: target3Character, monster: target3 },
			],
			channelManager: { sendMessages: () => Promise.resolve() },
			encounterEffects: [],
		};

		(player as any).xp = 100;
		(target1 as any).xp = 200;
		(target2 as any).xp = 600;
		(target3 as any).xp = 300;

		return pickPocket.play(player, target1, ring, ring.contestants).then(() => {
			expect(sampleStub.callCount).to.be.above(0);
			const callArg = sampleStub.firstCall.args[0];
			expect(callArg).to.deep.equal(
				(target2 as any).cards.filter((card: any) => !['Pick Pocket'].includes(card.cardType))
			);
		});
	});

	it('can pick pocket every card without error', () => {
		const pickPocket = new PickPocketCard();
		const player = randomContestant();
		const target1 = randomContestant();

		const cards = Object.values(allCards).filter(
			(C: any) => typeof C === 'function' && C.name !== 'PickPocketCard'
		);

		return expect(
			eachSeries(cards, (Card: any) => {
				if (Card.name !== 'PickPocketCard') {
					(target1 as any).monster.cards = [new Card()];

					const ring = {
						contestants: [player, target1],
						channelManager: { sendMessages: () => Promise.resolve() },
						encounterEffects: [],
					};

					return pickPocket.play(
						(player as any).monster,
						(target1 as any).monster,
						ring,
						ring.contestants
					);
				}

				return Promise.resolve();
			})
		).to.eventually.be.fulfilled;
	});

	it("cannot pick from own player's pocket", () => {
		const pickPocket = new PickPocketCard();

		const player = new Gladiator({ name: 'player' });
		const target1 = new Gladiator({ name: 'target1' });
		const target2 = new Gladiator({ name: 'target2' });
		const target3 = new Gladiator({ name: 'target3' });

		const ring: any = {
			contestants: [
				{ character: {}, monster: player },
				{ character: {}, monster: target1 },
				{ character: {}, monster: target2 },
				{ character: {}, monster: target3 },
			],
			channelManager: { sendMessages: () => Promise.resolve() },
			encounterEffects: [],
		};

		(player as any).xp = 600;
		(target1 as any).xp = 100;
		(target2 as any).xp = 200;
		(target3 as any).xp = 500;

		sampleStub.withArgs((target3 as any).cards).returns(new DestroyCard());

		return pickPocket.play(player, target1, ring, ring.contestants).then(() => {
			expect(sampleStub.callCount).to.be.above(0);
			const callArg = sampleStub.firstCall.args[0];
			expect(callArg).to.deep.equal(
				(target3 as any).cards.filter((card: any) => !['Pick Pocket'].includes(card.cardType))
			);
		});
	});
});
