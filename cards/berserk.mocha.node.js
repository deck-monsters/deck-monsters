const { expect, sinon } = require('../shared/test-setup');

const BerserkCard = require('./berserk');
const Gladiator = require('../monsters/gladiator');
const Minotaur = require('../monsters/minotaur');
const pause = require('../helpers/pause');
const { roll } = require('../helpers/chance');

const { BARBARIAN } = require('../helpers/classes');

const ultraComboNarration = [
	'HUMILIATION! 17 hits, 1 damage overkill',
	'HUMILIATION! 18 hits, 2 damage overkill',
	'HUMILIATION! 19 hits, 3 damage overkill',
	'HUMILIATION! 20 hits, 4 damage overkill',
	'HUMILIATION! 21 hits, 5 damage overkill',
	'HUMILIATION! 22 hits, 6 damage overkill',
	'HUMILIATION! 23 hits, 7 damage overkill',
	'HUMILIATION! 24 hits, 8 damage overkill',
	'HUMILIATION! 25 hits, 9 damage overkill',
	'HUMILIATION! 26 hits, 10 damage overkill',
	'HUMILIATION! 27 hits, 11 damage overkill',
	'HUMILIATION! 28 hits, 12 damage overkill',
	'HUMILIATION! 29 hits, 13 damage overkill',
	'HUMILIATION! 30 hits, 14 damage overkill',
	'HUMILIATION! 31 hits, 15 damage overkill',
	'HUMILIATION! 32 hits, 16 damage overkill',
	'HUMILIATION! 33 hits, 17 damage overkill',
	'HUMILIATION! 34 hits, 18 damage overkill',
	'HUMILIATION! 35 hits, 19 damage overkill',
	'HUMILIATION! 36 hits, 20 damage overkill',
	'HUMILIATION! 37 hits, 21 damage overkill',
	'HUMILIATION! 38 hits, 22 damage overkill',
	'HUMILIATION! 39 hits, 23 damage overkill',
	'HUMILIATION! 40 hits, 24 damage overkill',
	'HUMILIATION! 41 hits, 25 damage overkill',
	'HUMILIATION! 42 hits, 26 damage overkill',
	'HUMILIATION! 43 hits, 27 damage overkill',
	'HUMILIATION! 44 hits, 28 damage overkill',
	'HUMILIATION! 45 hits, 29 damage overkill',
	'HUMILIATION! 46 hits, 30 damage overkill',
	'HUMILIATION! 47 hits, 31 damage overkill',
	'HUMILIATION! 48 hits, 32 damage overkill',
	'HUMILIATION! 49 hits, 33 damage overkill',
	'HUMILIATION! 50 hits, 34 damage overkill',
	'HUMILIATION! 51 hits, 35 damage overkill',
	'HUMILIATION! 52 hits, 36 damage overkill',
	'HUMILIATION! 53 hits, 37 damage overkill',
	'HUMILIATION! 54 hits, 38 damage overkill',
	'HUMILIATION! 55 hits, 39 damage overkill',
	'HUMILIATION! 56 hits, 40 damage overkill',
	'HUMILIATION! 57 hits, 41 damage overkill',
	'HUMILIATION! 58 hits, 42 damage overkill',
	'HUMILIATION! 59 hits, 43 damage overkill',
	'HUMILIATION! 60 hits, 44 damage overkill',
	'HUMILIATION! 61 hits, 45 damage overkill',
	'HUMILIATION! 62 hits, 46 damage overkill',
	'HUMILIATION! 63 hits, 47 damage overkill',
	'HUMILIATION! 64 hits, 48 damage overkill',
	'HUMILIATION! 65 hits, 49 damage overkill',
	'HUMILIATION! 66 hits, 50 damage overkill',
	'HUMILIATION! 67 hits, 51 damage overkill',
	'HUMILIATION! 68 hits, 52 damage overkill',
	'HUMILIATION! 69 hits, 53 damage overkill',
	'HUMILIATION! 70 hits, 54 damage overkill',
	'HUMILIATION! 71 hits, 55 damage overkill',
	'HUMILIATION! 72 hits, 56 damage overkill',
	'HUMILIATION! 73 hits, 57 damage overkill',
	'HUMILIATION! 74 hits, 58 damage overkill',
	'HUMILIATION! 75 hits, 59 damage overkill',
	'HUMILIATION! 76 hits, 60 damage overkill',
	'HUMILIATION! 77 hits, 61 damage overkill',
	'HUMILIATION! 78 hits, 62 damage overkill',
	'HUMILIATION! 79 hits, 63 damage overkill',
	'HUMILIATION! 80 hits, 64 damage overkill',
	'HUMILIATION! 81 hits, 65 damage overkill',
	'HUMILIATION! 82 hits, 66 damage overkill',
	'HUMILIATION! 83 hits, 67 damage overkill',
	'HUMILIATION! 84 hits, 68 damage overkill',
	'HUMILIATION! 85 hits, 69 damage overkill',
	'HUMILIATION! 86 hits, 70 damage overkill',
	'HUMILIATION! 87 hits, 71 damage overkill',
	'HUMILIATION! 88 hits, 72 damage overkill',
	'HUMILIATION! 89 hits, 73 damage overkill',
	'HUMILIATION! 90 hits, 74 damage overkill',
	'HUMILIATION! 91 hits, 75 damage overkill',
	'HUMILIATION! 92 hits, 76 damage overkill',
	'HUMILIATION! 93 hits, 77 damage overkill',
	'HUMILIATION! 94 hits, 78 damage overkill',
	'HUMILIATION! 95 hits, 79 damage overkill',
	'HUMILIATION! 96 hits, 80 damage overkill',
	'HUMILIATION! 97 hits, 81 damage overkill',
	'HUMILIATION! 98 hits, 82 damage overkill',
	'HUMILIATION! 99 hits, 83 damage overkill',
	'HUMILIATION! 100 hits, 84 damage overkill',
	'ULTRA COMBO! 101 HITS'
]

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
		expect(berserk.stats).to.equal('Hit: 1d20 vs AC until you miss\n1 damage per hit.\n\nStroke of luck increases damage per hit by 1.');// eslint-disable-line max-len
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

		const attackRoll = roll({ primaryDice: '1d20', modifier: player.attackModifier, bonusDice: player.bonusAttackDice });
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

		const attackRoll = roll({ primaryDice: '1d20', modifier: player.attackModifier, bonusDice: player.bonusAttackDice });
		hitCheckStub.onFirstCall().returns({
			attackRoll,
			success: true,
			strokeOfLuck: true,
			curseOfLoki: false
		});
		hitCheckStub.onSecondCall().returns({
			attackRoll,
			success: true,
			strokeOfLuck: true,
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

		const attackRoll = roll({ primaryDice: '1d20', modifier: player.attackModifier, bonusDice: player.bonusAttackDice });
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

		let narrations = []
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

		const attackRoll = roll({ primaryDice: '1d20', modifier: player.attackModifier, bonusDice: player.bonusAttackDice });
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

		let narrations = []
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
