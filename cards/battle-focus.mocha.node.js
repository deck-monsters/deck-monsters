const { expect, sinon } = require('../shared/test-setup');

const BattleFocusCard = require('./battle-focus');
const Gladiator = require('../monsters/gladiator');
const Minotaur = require('../monsters/minotaur');

const { GLADIATOR } = require('../constants/creature-types');

const ultimateComboNarration = [];
for (let i = 17; i < 101; i++) {
	ultimateComboNarration.push(`HUMILIATION! ${i} hits`);
}
ultimateComboNarration.push('ULTIMATE COMBO! 100 HITS (109 total damage).');

describe('./cards/battle-focus.js', () => {
	it('can be instantiated with defaults', () => {
		const battleFocus = new BattleFocusCard();

		expect(battleFocus).to.be.an.instanceof(BattleFocusCard);
		expect(battleFocus.bigFirstHit).to.be.true;
		expect(battleFocus.damageAmount).to.equal(1);
		expect(battleFocus.damageDice).to.equal('1d6');
		expect(battleFocus.stats).to.equal('Hit: 1d20 + str bonus vs ac on first hit\nthen also + int bonus (fatigued by 1 each subsequent hit) until you miss\n1d6 damage on first hit.\n1 damage per hit after that.\n\nStroke of luck increases damage per hit by 1.');// eslint-disable-line max-len
	});

	it('can be instantiated with options', () => {
		const battleFocus = new BattleFocusCard({ damage: 4, damageDice: '2d4', bigFirstHit: false });

		expect(battleFocus).to.be.an.instanceof(BattleFocusCard);
		expect(battleFocus.bigFirstHit).to.be.false;
		expect(battleFocus.damageAmount).to.equal(4);
		expect(battleFocus.damageDice).to.equal('2d4');
	});

	it('can only be played by Gladiators', () => {
		const battleFocus = new BattleFocusCard();

		expect(battleFocus.permittedClassesAndTypes).to.deep.equal([GLADIATOR]);
	});

	it('Hits for 1d6 and then 1 until attack misses', () => {
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
		const getDamageRollStub = sinon.stub(berserkProto, 'getDamageRoll').callsFake(() =>
			({ naturalRoll: { result: 4 }, result: 5 }));
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

		const attackRoll = battleFocus.getAttackRoll(player);
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
				berserkEffectSpy.restore();
				berserkEffectLoopSpy.restore();
				hitEffectSpy.restore();
				hitSpy.restore();

				expect(berserkEffectSpy.callCount).to.equal(1);
				expect(berserkEffectLoopSpy.callCount).to.equal(3);
				expect(hitCheckStub.callCount).to.equal(3);
				expect(hitEffectSpy.callCount).to.equal(0);
				expect(hitSpy.callCount).to.equal(2);

				return expect(target.hp).to.equal(before - 6);
			});
	});

	it('Permakills if target HP < bigFirstHit damage amount and then combos until humiliation.', () => {
		const battleFocus = new BattleFocusCard();
		const player = new Gladiator({ name: 'player' });
		const target = new Minotaur({ name: 'target', hpVariance: 0 });
		target.hp = 1;

		const battleFocusProto = Object.getPrototypeOf(battleFocus);
		const berserkProto = Object.getPrototypeOf(battleFocusProto);
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
		const getDamageRollStub = sinon.stub(berserkProto, 'getDamageRoll');
		getDamageRollStub.returns({
			result: 10,
			naturalRoll: { result: 10 },
			strokeOfLuck: false,
			curseOfLoki: false
		});

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		const attackRoll = battleFocus.getAttackRoll(player);
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
		battleFocus.on('narration', (className, monster, { narration }) => {
			narrations.push(narration);
		});

		return battleFocus
			.play(player, target, ring, ring.contestants)
			.then(() => {
				hitCheckStub.restore();
				hitEffectSpy.restore();
				checkSuccessStub.restore();
				hitSpy.restore();
				berserkEffectSpy.restore();
				berserkEffectLoopSpy.restore();
				getDamageRollStub.restore();

				expect(berserkEffectSpy.callCount).to.equal(1);
				expect(berserkEffectLoopSpy.callCount).to.equal(101);
				expect(hitCheckStub.callCount).to.equal(101);
				expect(hitEffectSpy.callCount).to.equal(0);
				expect(hitSpy.callCount).to.equal(16);
				expect(narrations).to.deep.equal(ultimateComboNarration);
				expect(target.destroyed).to.be.true;

				return expect(target.hp).to.be.below(-Math.floor(target.maxHp / 2));
			});
	});
});
