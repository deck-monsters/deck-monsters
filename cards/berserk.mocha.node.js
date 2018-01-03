const { expect, sinon } = require('../shared/test-setup');

const BerserkCard = require('./berserk');
const Gladiator = require('../monsters/gladiator');
const Minotaur = require('../monsters/minotaur');
const pause = require('../helpers/pause');
const { roll } = require('../helpers/chance');

const { GLADIATOR } = require('../helpers/creature-types');

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
		expect(berserk.damageAmount).to.equal(1);
		expect(berserk.stats).to.equal('Hit: 1d20 vs AC until you miss\n1 damage per hit.\n\nStroke of luck increases damage per hit by 1.');// eslint-disable-line max-len
	});

	it('can be instantiated with options', () => {
		const berserk = new BerserkCard({ damage: 4 });

		expect(berserk).to.be.an.instanceof(BerserkCard);
		expect(berserk.damageAmount).to.equal(4);
	});

	it('can only be played by Gladiators', () => {
		const berserk = new BerserkCard();

		expect(berserk.permittedClassesAndTypes).to.deep.equal([GLADIATOR]);
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
				expect(berserkEffectSpy.callCount).to.equal(3);
				expect(hitCheckStub.callCount).to.equal(3);
				expect(hitEffectSpy.callCount).to.equal(0);
				expect(hitSpy.callCount).to.equal(2);
				hitCheckStub.restore();
				hitEffectSpy.restore();
				checkSuccessStub.restore();
				hitSpy.restore();
				berserkEffectSpy.restore();

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
});
