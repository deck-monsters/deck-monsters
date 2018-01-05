const { expect, sinon } = require('../shared/test-setup');

const HitCard = require('./hit');
const HitHarderCard = require('./hit-harder');
const RehitCard = require('./rehit');
const Basilisk = require('../monsters/basilisk');
const Minotaur = require('../monsters/minotaur');
const pause = require('../helpers/pause');

describe('./cards/hit.js', () => {
	let channelStub;
	let pauseStub;

	before(() => {
		channelStub = sinon.stub();
		pauseStub = sinon.stub(pause, 'setTimeout');
	});

	beforeEach(() => {
		channelStub.resolves();
		pauseStub.callsArg(0);
	});

	afterEach(() => {
		channelStub.reset();
		pauseStub.reset();
	});

	after(() => {
		pause.setTimeout.restore();
	});

	it('can be instantiated with defaults', () => {
		const hit = new HitCard();

		expect(hit).to.be.an.instanceof(HitCard);
		expect(hit.attackDice).to.equal('1d20');
		expect(hit.damageDice).to.equal('1d6');
		expect(hit.stats).to.equal('Hit: 1d20 vs AC / Damage: 1d6');
	});

	it('can be instantiated with options', () => {
		const hit = new HitCard({ attackDice: '2d20', damageDice: '2d6' });

		expect(hit).to.be.an.instanceof(HitCard);
		expect(hit.attackDice).to.equal('2d20');
		expect(hit.damageDice).to.equal('2d6');
		expect(hit.stats).to.equal('Hit: 2d20 vs AC / Damage: 2d6');
	});

	it('can be played', () => {
		const hit = new HitCard();

		const player = new Basilisk({ name: 'player' });
		const target = new Minotaur({ name: 'target' });
		const roll = hit.getDamageRoll(player, target);

		expect(roll.modifier).to.equal(3);
	});

	it('pops and becomes either rehit or hit harder on strokeOfLuck', () => {
		const player = new Basilisk({ name: 'player' });
		player.cards = [new HitCard(), new HitCard(), new HitCard(), new HitCard(), new HitCard()];
		const target = new Minotaur({ name: 'target' });

		const hit = new HitCard();
		const hitProto = Object.getPrototypeOf(hit);
		const attackRollStub = sinon.stub(hitProto, 'getAttackRoll');

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		attackRollStub.returns({ primaryDice: '1d20', result: 20, naturalRoll: { rolled: [20], result: 20 }, bonusResult: 0, modifier: 0 });

		expect(player.cards[0]).to.be.an.instanceof(HitCard);

		return hit
			.play(player, target, ring, ring.contestants)
			.then(() => {
				attackRollStub.restore();

				return expect([new HitHarderCard(), new RehitCard()]).to.include(player.cards[0]);
			});
	});
});
