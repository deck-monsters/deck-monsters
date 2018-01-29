const { expect, sinon } = require('../shared/test-setup');
const proxyquire = require('proxyquire');
const sample = require('lodash.sample');

const { randomCharacter } = require('../characters');
const { randomContestant } = require('../helpers/bosses');
const DestroyCard = require('./destroy');
const pause = require('../helpers/pause');

const Gladiator = require('../monsters/gladiator');

const allCards = require('./helpers/all');

describe('./cards/pick-pocket.js', () => {
	let PickPocketCard;
	let channelStub;
	let pauseStub;
	let sampleSpy;

	before(() => {
		channelStub = sinon.stub();
		pauseStub = sinon.stub(pause, 'setTimeout');
		sampleSpy = sinon.stub();

		PickPocketCard = proxyquire('./pick-pocket', {
			'lodash.sample': sampleSpy
		});
	});

	beforeEach(() => {
		channelStub.resolves();
		pauseStub.callsArg(0);
		sampleSpy.callsFake(sample);
	});

	afterEach(() => {
		channelStub.reset();
		pauseStub.reset();
		sampleSpy.reset();
	});

	after(() => {
		pause.setTimeout.restore();
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

		const ring = {
			contestants: [
				{ character: playerCharacter, monster: player },
				{ character: target1Character, monster: target1 },
				{ character: target2Character, monster: target2 },
				{ character: target3Character, monster: target3 }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		player.xp = 100;
		target1.xp = 200;
		target2.xp = 600;
		target3.xp = 300;

		return pickPocket
			.play(player, target1, ring, ring.contestants)
			.then(() => {
				expect(sampleSpy).to.have.been.calledWith(target2.cards.filter(card => !['Pick Pocket'].includes(card.cardType)));
			});
	});

	it('can pick pocket every card without error', () => {
		const pickPocket = new PickPocketCard();
		const player = randomContestant();
		const target1 = randomContestant();

		const promises = [];

		for (let i = 0; i < allCards.length; i++) {
			if (allCards[i].name !== 'PickPocketCard') {
				target1.monster.cards = [new allCards[i]()];

				const ring = {
					contestants: [
						player,
						target1
					],
					channelManager: {
						sendMessages: () => Promise.resolve()
					}
				};

				promises.push(pickPocket.play(player.monster, target1.monster, ring, ring.contestants));
			}
		}

		return expect(Promise.all(promises)).to.be.fulfilled;
	});

	it('cannot pick from own player\'s pocket', () => {
		const pickPocket = new PickPocketCard();

		const player = new Gladiator({ name: 'player' });
		const target1 = new Gladiator({ name: 'target1' });
		const target2 = new Gladiator({ name: 'target2' });
		const target3 = new Gladiator({ name: 'target3' });

		const ring = {
			contestants: [
				{ character: {}, monster: player },
				{ character: {}, monster: target1 },
				{ character: {}, monster: target2 },
				{ character: {}, monster: target3 }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		// player has most xp, but will not get picked
		player.xp = 600;
		target1.xp = 100;
		target2.xp = 200;
		target3.xp = 500;

		sampleSpy.withArgs(target3.cards).returns(new DestroyCard());

		return pickPocket
			.play(player, target1, ring, ring.contestants)
			.then(() => {
				expect(sampleSpy).to.have.been.calledWith(target3.cards.filter(card => !['Pick Pocket'].includes(card.cardType)));
				expect(target2.dead).to.be.true;
				expect(target3.dead).to.be.true;
				expect(player.dead).to.be.false;
				return expect(target1.dead).to.be.true;
			});
	});
});
