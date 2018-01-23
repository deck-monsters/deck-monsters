const { expect, sinon } = require('../shared/test-setup');

const BerserkCard = require('./berserk');
const Gladiator = require('../monsters/gladiator');
const Minotaur = require('../monsters/minotaur');
const pause = require('../helpers/pause');

const { BARBARIAN } = require('../helpers/classes');

const ultraComboNarration = [];
for (let i = 17; i < 101; i++) {
	ultraComboNarration.push(`HUMILIATION! ${i} hits`);
}
ultraComboNarration.push('ULTRA COMBO! 100 HITS');


describe('./cards/berserk.js', () => {
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
		const berserk = new BerserkCard();

		expect(berserk).to.be.an.instanceof(BerserkCard);
		expect(berserk.bigFirstHit).to.be.false;
		expect(berserk.damageAmount).to.equal(1);
		expect(berserk.stats).to.equal('Hit: 1d20 + attack bonus vs AC on first hit\nthen also + spell bonus (fatigued by 1 each subsequent hit) until you miss\n1 damage per hit.\n\nStroke of luck increases damage per hit by 1.');// eslint-disable-line max-len
	});

	it('can be instantiated with options', () => {
		const berserk = new BerserkCard({ damage: 4, bigFirstHit: true });

		expect(berserk).to.be.an.instanceof(BerserkCard);
		expect(berserk.bigFirstHit).to.be.true;
		expect(berserk.damageAmount).to.equal(4);
	});

	it('can only be played by Gladiators', () => {
		const berserk = new BerserkCard();

		expect(berserk.permittedClassesAndTypes).to.deep.equal([BARBARIAN]);
	});

	it('Hits for 1 until attack misses', () => {
		const berserk = new BerserkCard();
		const player = new Gladiator({ name: 'player' });
		const target = new Minotaur({ name: 'target' });
		const before = target.hp;

		const berserkProto = Object.getPrototypeOf(berserk);
		const hitProto = Object.getPrototypeOf(berserkProto);
		const baseProto = Object.getPrototypeOf(hitProto);
		const minotaurProto = Object.getPrototypeOf(target);
		const creatureProto = Object.getPrototypeOf(minotaurProto);

		// checkSuccess must return true in order for hit to be called from hitCheck
		const checkSuccessStub = sinon.stub(baseProto, 'checkSuccess').callsFake(() =>// eslint-disable-line no-unused-vars
			({ success: true, strokeOfLuck: false, curseOfLoki: false }));
		const hitCheckStub = sinon.stub(hitProto, 'hitCheck');
		const berserkEffectSpy = sinon.spy(berserkProto, 'effect');
		const berserkEffectLoopSpy = sinon.spy(berserkProto, 'effectLoop');
		const hitEffectSpy = sinon.spy(hitProto, 'effect');
		const hitSpy = sinon.spy(creatureProto, 'hit');

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		const attackRoll = berserk.getAttackRoll(player);
		hitCheckStub.onFirstCall().returns({
			attackRoll,
			success: true,
			strokeOfLuck: false,
			curseOfLoki: false
		});
		hitCheckStub.onSecondCall().returns({
			attackRoll,
			success: true,
			strokeOfLuck: false,
			curseOfLoki: false
		});
		hitCheckStub.returns({
			attackRoll,
			success: false,
			strokeOfLuck: false,
			curseOfLoki: false
		});

		return berserk
			.play(player, target, ring, ring.contestants)
			.then(() => {
				hitCheckStub.restore();
				hitEffectSpy.restore();
				checkSuccessStub.restore();
				hitSpy.restore();
				berserkEffectSpy.restore();
				berserkEffectLoopSpy.restore();

				expect(berserkEffectSpy.callCount).to.equal(1);
				expect(berserkEffectLoopSpy.callCount).to.equal(3);
				expect(hitCheckStub.callCount).to.equal(3);
				expect(hitEffectSpy.callCount).to.equal(0);
				expect(hitSpy.callCount).to.equal(2);

				return expect(target.hp).to.equal(before - 2);
			});
	});

	describe('attackRollBonus', () => {
		it('takes iterations and intBonusFatigue into account', () => {
			const berserk = new BerserkCard();
			const player = new Gladiator({ name: 'player' });

			player.xp = 100;
			expect(player.intModifier).to.equal(2);
			expect(player.dexModifier).to.equal(3);

			berserk.intBonusFatigue = 0;
			expect(berserk.getAttackRollBonus(player)).to.equal(player.dexModifier);
			berserk.iterations = 2;
			berserk.intBonusFatigue = 0;
			expect(berserk.getAttackRollBonus(player)).to.equal(player.dexModifier + player.intModifier);
			berserk.intBonusFatigue = 1;
			expect(berserk.getAttackRollBonus(player)).to.equal(player.dexModifier + (player.intModifier - 1));
			berserk.intBonusFatigue = 10;
			expect(berserk.getAttackRollBonus(player)).to.equal(player.dexModifier);
		});
	});

	describe('fatigueIntBonus', () => {
		it('calculates fatigue properly', () => {
			const berserk = new BerserkCard();

			expect(berserk.fatigueIntBonus(undefined, 0)).to.equal(undefined);
			expect(berserk.fatigueIntBonus(undefined, 1)).to.equal(undefined);
			expect(berserk.fatigueIntBonus(undefined, 2)).to.equal(0);
			expect(berserk.fatigueIntBonus(0, 3)).to.equal(1);
			expect(berserk.fatigueIntBonus(0, 5)).to.equal(1);
			expect(berserk.fatigueIntBonus(2, 5)).to.equal(3);
		});
	});

	it('calls fatigueIntBonus each effectLoop iteration as expected', () => {
		const berserk = new BerserkCard();
		const player = new Gladiator({ name: 'player' });
		const target = new Minotaur({ name: 'target' });

		const berserkProto = Object.getPrototypeOf(berserk);
		const hitProto = Object.getPrototypeOf(berserkProto);
		const hitCheckStub = sinon.stub(hitProto, 'hitCheck');
		const fatigueIntBonusSpy = sinon.spy(berserkProto, 'fatigueIntBonus');

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		const attackRoll = berserk.getAttackRoll(player);
		hitCheckStub.returns({
			attackRoll,
			success: true,
			strokeOfLuck: false,
			curseOfLoki: false
		});
		hitCheckStub.onCall(4).returns({
			attackRoll,
			success: true,
			strokeOfLuck: true,
			curseOfLoki: false
		});
		hitCheckStub.onCall(8).returns({
			attackRoll,
			success: false,
			strokeOfLuck: false,
			curseOfLoki: false
		});

		expect(berserk.intBonusFatigue).to.be.undefined;
		expect(berserk.baseDiminishment).to.equal(-1);

		return berserk
			.play(player, target, ring, ring.contestants)
			.then(() => {
				hitCheckStub.restore();
				fatigueIntBonusSpy.restore();

				expect(fatigueIntBonusSpy.args[0]).to.deep.equal([undefined, 1]);
				expect(fatigueIntBonusSpy.args[1]).to.deep.equal([undefined, 2]);
				expect(fatigueIntBonusSpy.args[2]).to.deep.equal([0, 3]);
				expect(fatigueIntBonusSpy.args[3]).to.deep.equal([1, 4]);
				expect(fatigueIntBonusSpy.args[4]).to.deep.equal([2, 5]);
				expect(fatigueIntBonusSpy.args[5]).to.deep.equal([-1, 6]);
				expect(fatigueIntBonusSpy.args[6]).to.deep.equal([0, 7]);
				expect(fatigueIntBonusSpy.args[7]).to.deep.equal([1, 8]);
				expect(fatigueIntBonusSpy.returnValues[0]).to.equal(undefined);
				expect(fatigueIntBonusSpy.returnValues[1]).to.equal(0);
				expect(fatigueIntBonusSpy.returnValues[2]).to.equal(1);
				expect(fatigueIntBonusSpy.returnValues[3]).to.equal(2);
				expect(fatigueIntBonusSpy.returnValues[4]).to.equal(3);
				expect(fatigueIntBonusSpy.returnValues[5]).to.equal(0);
				expect(fatigueIntBonusSpy.returnValues[6]).to.equal(1);
				return expect(fatigueIntBonusSpy.returnValues[7]).to.equal(2);
			});
	});

	it('resets intBonusFatigue and baseDiminishment after play', () => {
		const berserk = new BerserkCard();
		const player = new Gladiator({ name: 'player' });
		const target = new Minotaur({ name: 'target' });

		const berserkProto = Object.getPrototypeOf(berserk);
		const hitProto = Object.getPrototypeOf(berserkProto);
		const hitCheckStub = sinon.stub(hitProto, 'hitCheck');

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		const attackRoll = berserk.getAttackRoll(player);
		hitCheckStub.returns({
			attackRoll,
			success: true,
			strokeOfLuck: false,
			curseOfLoki: false
		});
		hitCheckStub.onCall(4).returns({
			attackRoll,
			success: false,
			strokeOfLuck: false,
			curseOfLoki: false
		});

		expect(berserk.intBonusFatigue).to.be.undefined;
		expect(berserk.baseDiminishment).to.equal(-1);

		return berserk
			.play(player, target, ring, ring.contestants)
			.then(() => {
				hitCheckStub.restore();

				expect(berserk.baseDiminishment).to.equal(-1);
				return expect(berserk.intBonusFatigue).to.be.undefined;
			});
	});

	it('Increases attack strength on strokeOfLuck', () => {
		const berserk = new BerserkCard();
		const player = new Gladiator({ name: 'player' });
		const target = new Minotaur({ name: 'target' });
		const before = target.hp;

		const berserkProto = Object.getPrototypeOf(berserk);
		const hitProto = Object.getPrototypeOf(berserkProto);
		const baseProto = Object.getPrototypeOf(hitProto);
		const minotaurProto = Object.getPrototypeOf(target);
		const creatureProto = Object.getPrototypeOf(minotaurProto);

		// checkSuccess must return true in order for hit to be called from hitCheck
		const checkSuccessStub = sinon.stub(baseProto, 'checkSuccess').callsFake(() =>// eslint-disable-line no-unused-vars
			({ success: true, strokeOfLuck: false, curseOfLoki: false }));
		const hitCheckStub = sinon.stub(hitProto, 'hitCheck');
		const berserkEffectSpy = sinon.spy(berserkProto, 'effect');
		const hitEffectSpy = sinon.spy(hitProto, 'effect');
		const hitSpy = sinon.spy(creatureProto, 'hit');

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		const attackRoll = berserk.getAttackRoll(player);
		hitCheckStub.returns({
			attackRoll,
			success: true,
			strokeOfLuck: true,
			curseOfLoki: false
		});
		hitCheckStub.onThirdCall().returns({
			attackRoll,
			success: false,
			strokeOfLuck: false,
			curseOfLoki: false
		});

		return berserk
			.play(player, target, ring, ring.contestants)
			.then(() => {
				hitCheckStub.restore();
				hitEffectSpy.restore();
				checkSuccessStub.restore();
				hitSpy.restore();
				berserkEffectSpy.restore();

				expect(target.hp).to.equal(before - 5);
				return expect(berserk.damageAmount).to.equal(1);
			});
	});

	it('Continues hitting after opponent is dead, but does not do combo damage after reaching maxHp/2', () => {
		const berserk = new BerserkCard();
		const player = new Gladiator({ name: 'player' });
		const target = new Minotaur({ name: 'target', hpVariance: 0 });
		const before = target.hp;

		const berserkProto = Object.getPrototypeOf(berserk);
		const hitProto = Object.getPrototypeOf(berserkProto);
		const baseProto = Object.getPrototypeOf(hitProto);
		const minotaurProto = Object.getPrototypeOf(target);
		const creatureProto = Object.getPrototypeOf(minotaurProto);

		// checkSuccess must return true in order for hit to be called from hitCheck
		const checkSuccessStub = sinon.stub(baseProto, 'checkSuccess').callsFake(() =>// eslint-disable-line no-unused-vars
			({ success: true, strokeOfLuck: false, curseOfLoki: false }));
		const hitCheckStub = sinon.stub(hitProto, 'hitCheck');
		const berserkEffectSpy = sinon.spy(berserkProto, 'effect');
		const berserkEffectLoopSpy = sinon.spy(berserkProto, 'effectLoop');
		const hitEffectSpy = sinon.spy(hitProto, 'effect');
		const hitSpy = sinon.spy(creatureProto, 'hit');

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		const attackRoll = berserk.getAttackRoll(player);
		hitCheckStub.returns({
			attackRoll,
			success: true,
			strokeOfLuck: false,
			curseOfLoki: false
		});

		hitCheckStub.onCall(100).returns({
			attackRoll,
			success: false,
			strokeOfLuck: false,
			curseOfLoki: false
		});

		const narrations = [];
		berserk.on('narration', (className, monster, { narration }) => {
			narrations.push(narration);
		});

		return berserk
			.play(player, target, ring, ring.contestants)
			.then(() => {
				hitCheckStub.restore();
				hitEffectSpy.restore();
				checkSuccessStub.restore();
				hitSpy.restore();
				berserkEffectSpy.restore();
				berserkEffectLoopSpy.restore();

				expect(berserkEffectSpy.callCount).to.equal(1);
				expect(berserkEffectLoopSpy.callCount).to.equal(101);
				expect(hitCheckStub.callCount).to.equal(101);
				expect(hitEffectSpy.callCount).to.equal(0);
				expect(hitSpy.callCount).to.equal(16);
				expect(narrations).to.deep.equal(ultraComboNarration);

				return expect(target.hp).to.equal(before - 16);
			});
	});

	it('hits player and announces flavor narration on COMBO BREAKER', () => {
		const berserk = new BerserkCard();
		const player = new Gladiator({ name: 'player', hpVariance: 0 });
		const target = new Minotaur({ name: 'target', hpVariance: 0 });
		const before = target.hp;
		const playerBeforeHp = player.hp;

		const berserkProto = Object.getPrototypeOf(berserk);
		const hitProto = Object.getPrototypeOf(berserkProto);
		const baseProto = Object.getPrototypeOf(hitProto);
		const minotaurProto = Object.getPrototypeOf(target);
		const creatureProto = Object.getPrototypeOf(minotaurProto);

		// checkSuccess must return true in order for hit to be called from hitCheck
		const checkSuccessStub = sinon.stub(baseProto, 'checkSuccess').callsFake(() =>// eslint-disable-line no-unused-vars
			({ success: true, strokeOfLuck: false, curseOfLoki: false }));
		const hitCheckStub = sinon.stub(hitProto, 'hitCheck');
		const berserkEffectSpy = sinon.spy(berserkProto, 'effect');
		const berserkEffectLoopSpy = sinon.spy(berserkProto, 'effectLoop');
		const hitEffectSpy = sinon.spy(hitProto, 'effect');
		const hitSpy = sinon.spy(creatureProto, 'hit');

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		const attackRoll = berserk.getAttackRoll(player);
		hitCheckStub.returns({
			attackRoll,
			success: true,
			strokeOfLuck: false,
			curseOfLoki: false
		});

		hitCheckStub.onCall(4).returns({
			attackRoll,
			success: false,
			strokeOfLuck: false,
			curseOfLoki: true
		});

		const narrations = [];
		berserk.on('narration', (className, monster, { narration }) => {
			narrations.push(narration);
		});

		return berserk
			.play(player, target, ring, ring.contestants)
			.then(() => {
				hitCheckStub.restore();
				hitEffectSpy.restore();
				checkSuccessStub.restore();
				hitSpy.restore();
				berserkEffectSpy.restore();
				berserkEffectLoopSpy.restore();

				expect(berserkEffectSpy.callCount).to.equal(1);
				expect(berserkEffectLoopSpy.callCount).to.equal(5);
				expect(hitCheckStub.callCount).to.equal(5);
				expect(hitEffectSpy.callCount).to.equal(0);
				expect(hitSpy.callCount).to.equal(5);

				expect(narrations).to.deep.equal(['COMBO BREAKER!']);

				expect(player.hp).to.equal(playerBeforeHp - 1);
				return expect(target.hp).to.equal(before - 4);
			});
	});
});
