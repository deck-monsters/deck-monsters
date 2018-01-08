const { expect, sinon } = require('../shared/test-setup');

const BattleFocusCard = require('./battle-focus');
const Gladiator = require('../monsters/gladiator');
const Minotaur = require('../monsters/minotaur');
const pause = require('../helpers/pause');
const { roll } = require('../helpers/chance');

const { GLADIATOR } = require('../helpers/creature-types');

describe('./cards/battle-focus.js', () => {
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
		const battleFocus = new BattleFocusCard();

		expect(battleFocus).to.be.an.instanceof(BattleFocusCard);
		expect(battleFocus.damageAmount).to.equal(1);
		expect(battleFocus.damageDice).to.equal('1d4');
		expect(battleFocus.stats).to.equal('Hit: 1d20 vs AC until you miss\n1d4 damage on first hit.\n1 damage per hit after that.\n\nStroke of luck increases damage per hit by 1.');// eslint-disable-line max-len
	});

	it('can be instantiated with options', () => {
		const battleFocus = new BattleFocusCard({ damage: 4, damageDice: '2d4' });

		expect(battleFocus).to.be.an.instanceof(BattleFocusCard);
		expect(battleFocus.damageAmount).to.equal(4);
		expect(battleFocus.damageDice).to.equal('2d4');
	});

	it('can only be played by Gladiators', () => {
		const battleFocus = new BattleFocusCard();

		expect(battleFocus.permittedClassesAndTypes).to.deep.equal([GLADIATOR]);
	});

	it('Hits for 1 until attack misses', () => {
		const battleFocus = new BattleFocusCard();
		const player = new Gladiator({ name: 'player' });
		const target = new Minotaur({ name: 'target' });
		const before = target.hp;

		const battleFocusProto = Object.getPrototypeOf(battleFocus);
		const berserkProto = Object.getPrototypeOf(battleFocusProto);
		const hitProto = Object.getPrototypeOf(berserkProto);
		const baseProto = Object.getPrototypeOf(hitProto);
		const minotaurProto = Object.getPrototypeOf(target);
		const creatureProto = Object.getPrototypeOf(minotaurProto);

		// checkSuccess must return true in order for hit to be called from hitCheck
		const checkSuccessStub = sinon.stub(baseProto, 'checkSuccess').callsFake(() =>
			({ success: true, strokeOfLuck: false, curseOfLoki: false }));
		const hitCheckStub = sinon.stub(hitProto, 'hitCheck');
		const getDamageRollStub = sinon.stub(hitProto, 'getDamageRoll').callsFake(() =>
			({ naturalRoll: { result: 4 }, result: 5 }));
		const battleFocusEffectSpy = sinon.spy(battleFocusProto, 'effect');
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

		return battleFocus
			.play(player, target, ring, ring.contestants)
			.then(() => {
				checkSuccessStub.restore();
				hitCheckStub.restore();
				getDamageRollStub.restore();
				battleFocusEffectSpy.restore();
				berserkEffectSpy.restore();
				hitEffectSpy.restore();
				hitSpy.restore();

				expect(battleFocusEffectSpy.callCount).to.equal(1);
				expect(berserkEffectSpy.callCount).to.equal(2);
				expect(hitCheckStub.callCount).to.equal(3);
				expect(hitEffectSpy.callCount).to.equal(0);
				expect(hitSpy.callCount).to.equal(2);

				return expect(target.hp).to.equal(before - 6);
			});
	});

	it('Increases attack strength on strokeOfLuck', () => {
		const battleFocus = new BattleFocusCard();
		const player = new Gladiator({ name: 'player' });
		const target = new Minotaur({ name: 'target' });
		const before = target.hp;

		const battleFocusProto = Object.getPrototypeOf(battleFocus);
		const berserkProto = Object.getPrototypeOf(battleFocusProto);
		const hitProto = Object.getPrototypeOf(berserkProto);
		const baseProto = Object.getPrototypeOf(hitProto);
		const minotaurProto = Object.getPrototypeOf(target);
		const creatureProto = Object.getPrototypeOf(minotaurProto);

		// checkSuccess must return true in order for hit to be called from hitCheck
		const checkSuccessStub = sinon.stub(baseProto, 'checkSuccess').callsFake(() =>
			({ success: true, strokeOfLuck: false, curseOfLoki: false }));
		const hitCheckStub = sinon.stub(hitProto, 'hitCheck');
		const getDamageRollStub = sinon.stub(hitProto, 'getDamageRoll').callsFake(() =>
			({ naturalRoll: { result: 4 }, result: 5 }));
		const battleFocusEffectSpy = sinon.spy(battleFocusProto, 'effect');
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
			strokeOfLuck: false,
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

		return battleFocus
			.play(player, target, ring, ring.contestants)
			.then(() => {
				checkSuccessStub.restore();
				hitCheckStub.restore();
				getDamageRollStub.restore();
				battleFocusEffectSpy.restore();
				berserkEffectSpy.restore();
				hitEffectSpy.restore();
				hitSpy.restore();

				expect(target.hp).to.equal(before - 7);
				return expect(battleFocus.damageAmount).to.equal(1);
			});
	});
});
