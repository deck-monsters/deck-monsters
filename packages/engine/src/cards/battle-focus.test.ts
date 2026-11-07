import { expect } from 'chai';
import sinon from 'sinon';

import { BattleFocusCard } from './battle-focus.js';
import Gladiator from '../monsters/gladiator.js';
import Minotaur from '../monsters/minotaur.js';
import { GLADIATOR } from '../constants/creature-types.js';

// HUMILIATION ends the combo (bug 259): the 10-damage opener plus 16 one-point hits, the
// most the Minotaur's combo allows (half its max hp), then the next swing stops it.
const ultimateComboNarration = ['HUMILIATION! ULTIMATE COMBO! 17 HITS (26 total damage).'];

describe('./cards/battle-focus.ts', () => {
	it('can be instantiated with defaults', () => {
		const battleFocus = new BattleFocusCard();

		expect(battleFocus).to.be.an.instanceof(BattleFocusCard);
		expect((battleFocus as any).bigFirstHit).to.be.true;
		expect((battleFocus as any).damageAmount).to.equal(1);
		expect((battleFocus as any).damageDice).to.equal('1d6');
		expect(battleFocus.stats).to.equal(
			'Hit: 1d20 + dex vs ac on first hit\nthen also + int bonus (fatigued by 1 each subsequent hit) until you miss,\nor until the combo has done half the target\'s max hp\n1d6 damage on first hit.\n1 damage per hit after that.\n\nStroke of luck increases damage per hit by 1.'
		);
	});

	it('can be instantiated with options', () => {
		const battleFocus = new BattleFocusCard({ damage: 4, damageDice: '2d4', bigFirstHit: false } as any);

		expect(battleFocus).to.be.an.instanceof(BattleFocusCard);
		expect((battleFocus as any).bigFirstHit).to.be.false;
		expect((battleFocus as any).damageAmount).to.equal(4);
		expect((battleFocus as any).damageDice).to.equal('2d4');
	});

	it('can only be played by Gladiators', () => {
		const battleFocus = new BattleFocusCard();

		expect((battleFocus as any).permittedClassesAndTypes).to.deep.equal([GLADIATOR]);
	});

	it('Hits for 1d6 and then 1 until attack misses', () => {
		const battleFocus = new BattleFocusCard();
		const player = new Gladiator({ name: 'player' });
		const target = new Minotaur({ name: 'target' });
		const before = (target as any).hp;

		const battleFocusProto = Object.getPrototypeOf(battleFocus);
		const berserkProto = Object.getPrototypeOf(battleFocusProto);
		const hitProto = Object.getPrototypeOf(berserkProto);
		const baseProto = Object.getPrototypeOf(hitProto);
		const minotaurProto = Object.getPrototypeOf(target);
		const creatureProto = Object.getPrototypeOf(minotaurProto);

		const checkSuccessStub = sinon.stub(baseProto, 'checkSuccess').callsFake(
			() => ({ success: true, strokeOfLuck: false, curseOfLoki: false })
		);
		const hitCheckStub = sinon.stub(hitProto, 'hitCheck');
		const getDamageRollStub = sinon.stub(berserkProto, 'getDamageRoll').callsFake(
			() => ({ naturalRoll: { result: 4 }, result: 5 })
		);
		const berserkEffectSpy = sinon.spy(berserkProto, 'effect');
		const berserkEffectLoopSpy = sinon.spy(berserkProto, 'effectLoop');
		const hitEffectSpy = sinon.spy(hitProto, 'effect');
		const hitSpy = sinon.spy(creatureProto, 'hit');

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		const attackRoll = battleFocus.getAttackRoll(player);
		hitCheckStub.onFirstCall().returns({ attackRoll, success: true, strokeOfLuck: false, curseOfLoki: false });
		hitCheckStub.onSecondCall().returns({ attackRoll, success: true, strokeOfLuck: false, curseOfLoki: false });
		hitCheckStub.returns({ attackRoll, success: false, strokeOfLuck: false, curseOfLoki: false });

		return battleFocus.play(player, target, ring, ring.contestants).then(() => {
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
			expect((target as any).hp).to.equal(before - 6);
		});
	});

	it('Permakills if target HP < bigFirstHit damage amount and then combos until humiliation.', () => {
		const battleFocus = new BattleFocusCard();
		const player = new Gladiator({ name: 'player' });
		const target = new Minotaur({ name: 'target', hpVariance: 0 });
		(target as any).hp = 1;

		const battleFocusProto = Object.getPrototypeOf(battleFocus);
		const berserkProto = Object.getPrototypeOf(battleFocusProto);
		const hitProto = Object.getPrototypeOf(berserkProto);
		const baseProto = Object.getPrototypeOf(hitProto);
		const minotaurProto = Object.getPrototypeOf(target);
		const creatureProto = Object.getPrototypeOf(minotaurProto);

		const checkSuccessStub = sinon.stub(baseProto, 'checkSuccess').callsFake(
			() => ({ success: true, strokeOfLuck: false, curseOfLoki: false })
		);
		const hitCheckStub = sinon.stub(hitProto, 'hitCheck');
		const berserkEffectSpy = sinon.spy(berserkProto, 'effect');
		const berserkEffectLoopSpy = sinon.spy(berserkProto, 'effectLoop');
		const hitEffectSpy = sinon.spy(hitProto, 'effect');
		const hitSpy = sinon.spy(creatureProto, 'hit');
		const getDamageRollStub = sinon.stub(berserkProto, 'getDamageRoll');
		getDamageRollStub.returns({ result: 10, naturalRoll: { result: 10 }, strokeOfLuck: false, curseOfLoki: false });

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		const attackRoll = battleFocus.getAttackRoll(player);
		hitCheckStub.returns({ attackRoll, success: true, strokeOfLuck: false, curseOfLoki: false });
		hitCheckStub.onCall(100).returns({ attackRoll, success: false, strokeOfLuck: false, curseOfLoki: false });

		const narrations: string[] = [];
		battleFocus.on('narration', (_className: any, _monster: any, { narration }: any) => {
			narrations.push(narration);
		});

		return battleFocus.play(player, target, ring, ring.contestants).then(() => {
			hitCheckStub.restore();
			hitEffectSpy.restore();
			checkSuccessStub.restore();
			hitSpy.restore();
			berserkEffectSpy.restore();
			berserkEffectLoopSpy.restore();
			getDamageRollStub.restore();

			expect(berserkEffectSpy.callCount).to.equal(1);
			expect(berserkEffectLoopSpy.callCount).to.equal(18);
			expect(hitCheckStub.callCount).to.equal(18);
			expect(hitEffectSpy.callCount).to.equal(0);
			expect(hitSpy.callCount).to.equal(17);
			expect(narrations).to.deep.equal(ultimateComboNarration);
			expect((target as any).destroyed).to.be.true;
			expect((target as any).hp).to.be.below(-(Math.floor((target as any).maxHp / 2)));
		});
	});
});
