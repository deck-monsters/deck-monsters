const { expect, sinon } = require('../shared/test-setup');

const { ABUNDANT } = require('../helpers/probabilities');
const { ALMOST_NOTHING } = require('../helpers/costs');

const HitCard = require('./hit');
const Basilisk = require('../monsters/basilisk');
const pause = require('../helpers/pause');

describe('./cards/hit.js', () => {
	let pauseStub;
	let hit;
	let hitEffectSpy;
	let hitCheckStub;
	let player;
	let target;
	let ring;


	before(() => {
		hit = new HitCard();
		pauseStub = sinon.stub(pause, 'setTimeout');
		hitEffectSpy = sinon.spy(hit, 'effect');
		hitCheckStub = sinon.stub(hit, 'hitCheck');
	});

	beforeEach(() => {
		pauseStub.callsArg(0);
		player = new Basilisk({ name: 'player' });
		target = new Basilisk({ name: 'target' });
		ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		hitCheckStub.returns({ attackRoll: hit.getAttackRoll(player), success: true, strokeOfLuck: false, curseOfLoki: false });
	});

	afterEach(() => {
		pauseStub.reset();
		hitEffectSpy.reset();
	});

	after(() => {
		pause.setTimeout.restore();
		hitEffectSpy.restore();
	});

	it('can be instantiated with defaults', () => {
		expect(hit).to.be.an.instanceof(HitCard);
		expect(hit.stats).to.equal('Hit: 1d20 vs ac / Damage: 1d6');
		expect(hit.probability).to.equal((ABUNDANT.probability + 10));
		expect(hit.cost).to.equal(ALMOST_NOTHING.cost);
		expect(hit.attackDice).to.equal('1d20');
		expect(hit.damageDice).to.equal('1d6');
		expect(hit.targetProp).to.equal('ac');
		expect(hit.icon).to.equal('👊');
		expect(hit.stats).to.equal('Hit: 1d20 vs ac / Damage: 1d6');
	});

	it('can be instantiated with options', () => {
		const customHit = new HitCard({ damageDice: '2d6', attackDice: '2d20', targetProp: 'int', icon: '😝' });
		expect(customHit).to.be.an.instanceof(HitCard);
		expect(customHit.probability).to.equal((ABUNDANT.probability + 10));
		expect(customHit.cost).to.equal(ALMOST_NOTHING.cost);
		expect(customHit.attackDice).to.equal('2d20');
		expect(customHit.damageDice).to.equal('2d6');
		expect(customHit.targetProp).to.equal('int');
		expect(customHit.icon).to.equal('😝');
		expect(customHit.stats).to.equal('Hit: 2d20 vs int / Damage: 2d6');
	});

	it('can be played', () => {
		const before = target.hp;

		return hit.play(player, target, ring)
			.then(() => {
				expect(target.hp).to.be.below(before);
				expect(hitEffectSpy).to.have.been.calledOnce;
				return expect(hitCheckStub).to.have.been.calledOnce;
			});
	});
});
