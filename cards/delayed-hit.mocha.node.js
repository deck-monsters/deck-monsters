const { expect, sinon } = require('../shared/test-setup');

const Promise = require('bluebird');

const { UNCOMMON } = require('../helpers/probabilities');
const { REASONABLE } = require('../helpers/costs');
const { DEFENSE_PHASE } = require('../helpers/phases');

const DelayedHitCard = require('./delayed-hit');
const HitCard = require('./hit');
const Basilisk = require('../monsters/basilisk');
const pause = require('../helpers/pause');

describe('./cards/delayed-hit.js', () => {
	let pauseStub;
	let hit;
	let delayedHit;
	let hitEffectSpy;
	let hitCheckStub;
	let delayedHitHitCheckStub;
	let player;
	let target;
	let ring;


	before(() => {
		hit = new HitCard();
		delayedHit = new DelayedHitCard();
		pauseStub = sinon.stub(pause, 'setTimeout');
		hitEffectSpy = sinon.spy(hit, 'effect');
		hitCheckStub = sinon.stub(hit, 'hitCheck');

		delayedHitHitCheckStub = sinon.stub(Object.getPrototypeOf(delayedHit), 'hitCheck');
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
			},
			encounterEffects: []
		};

		const successfulHit = { attackRoll: hit.getAttackRoll(player), success: true, strokeOfLuck: false, curseOfLoki: false };
		hitCheckStub.returns(successfulHit);
		delayedHitHitCheckStub.returns(successfulHit);
	});

	afterEach(() => {
		pauseStub.reset();
		hitEffectSpy.reset();
		hitCheckStub.reset();
		delayedHitHitCheckStub.reset();
	});

	after(() => {
		pause.setTimeout.restore();
		hitEffectSpy.restore();
		hitCheckStub.restore();
		delayedHitHitCheckStub.restore();
	});

	it('can be instantiated with defaults', () => {
		expect(delayedHit).to.be.an.instanceof(DelayedHitCard);
		expect(delayedHit.probability).to.equal(UNCOMMON);
		expect(delayedHit.cost).to.equal(REASONABLE.cost);
		expect(delayedHit.attackDice).to.equal('1d20');
		expect(delayedHit.damageDice).to.equal('1d6');
		expect(delayedHit.targetProp).to.equal('ac');
		expect(delayedHit.icon).to.equal('🤛');
		expect(delayedHit.stats).to.equal(`Delay your turn. Use the delayed turn to immediately hit the next player who hits you.
${hit.stats}`);
	});

	it('can be instantiated with options', () => {
		const customDelayedHit = new DelayedHitCard({ damageDice: '2d6', attackDice: '2d20', targetProp: 'int', icon: '😝' });
		const customHit = new HitCard({ damageDice: '2d6', attackDice: '2d20', targetProp: 'int', icon: '😝' });

		expect(customDelayedHit).to.be.an.instanceof(DelayedHitCard);
		expect(customDelayedHit.probability).to.equal(UNCOMMON);
		expect(customDelayedHit.cost).to.equal(REASONABLE.cost);
		expect(customDelayedHit.attackDice).to.equal('2d20');
		expect(customDelayedHit.damageDice).to.equal('2d6');
		expect(customDelayedHit.targetProp).to.equal('int');
		expect(customDelayedHit.icon).to.equal('😝');
		expect(customDelayedHit.stats).to.equal(`Delay your turn. Use the delayed turn to immediately hit the next player who hits you.
${customHit.stats}`);
	});

	it('can be played and is stack-able', () => {
		const previousTargetHP = target.hp;
		const previousPlayerHP = player.hp;

		expect(ring.encounterEffects.length).to.equal(0);

		return delayedHit.play(player, target, ring)
			.then(() => expect(ring.encounterEffects.length).to.equal(1))
			.then(() => Promise.delay(1))
			.then(() => {
				expect(target.hp).to.equal(previousTargetHP);
				expect(player.hp).to.equal(previousPlayerHP);
				expect(hitEffectSpy).to.not.have.been.called;
				return expect(hitCheckStub).to.not.have.been.called;
			})
			.then(() => delayedHit.play(player, target, ring))
			.then(() => expect(ring.encounterEffects.length).to.equal(2))
			.then(() => Promise.delay(1)) // make sure hit card play occurs after delayHit card play
			.then(() => {
				expect(target.hp).to.equal(previousTargetHP);
				expect(player.hp).to.equal(previousPlayerHP);
				expect(hitEffectSpy).to.not.have.been.called;
				return expect(hitCheckStub).to.not.have.been.called;
			})
			.then(() => ring.encounterEffects[0]({ phase: DEFENSE_PHASE, ring, card: hit }))
			.then(() => ring.encounterEffects[1]({ phase: DEFENSE_PHASE, ring, card: hit }))
			.then(() => hit.play(target, player, ring))
			.then(() => expect(ring.encounterEffects.length).to.equal(0))
			.then(() => {
				expect(target.hp).to.be.below(previousTargetHP);
				expect(player.hp).to.be.below(previousPlayerHP);
				expect(delayedHitHitCheckStub).to.have.been.calledTwice;
				return expect(hitCheckStub).to.have.been.calledOnce;
			});
	});
});
