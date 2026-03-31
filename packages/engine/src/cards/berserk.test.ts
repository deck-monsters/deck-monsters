import { expect } from 'chai';
import sinon from 'sinon';

import { BerserkCard } from './berserk.js';
import Gladiator from '../monsters/gladiator.js';
import Minotaur from '../monsters/minotaur.js';
import { BARBARIAN } from '../constants/creature-classes.js';

const ultimateComboNarration: string[] = [];
for (let i = 5; i < 101; i++) {
	ultimateComboNarration.push(`HUMILIATION! ${i} hits`);
}
ultimateComboNarration.push('ULTIMATE COMBO! 100 HITS (5150 total damage).');

describe('./cards/berserk.ts', () => {
	it('can be instantiated with defaults', () => {
		const berserk = new BerserkCard();

		expect(berserk).to.be.an.instanceof(BerserkCard);
		expect((berserk as any).bigFirstHit).to.be.false;
		expect((berserk as any).damageAmount).to.equal(1);
		expect(berserk.stats).to.equal(
			'Hit: 1d20 + str bonus vs ac on first hit\nthen also + int bonus (fatigued by 1 each subsequent hit) until you miss\n1 damage per hit.\n\nStroke of luck increases damage per hit by 1.'
		);
	});

	it('can be instantiated with options', () => {
		const berserk = new BerserkCard({ damage: 4, bigFirstHit: true } as any);

		expect(berserk).to.be.an.instanceof(BerserkCard);
		expect((berserk as any).bigFirstHit).to.be.true;
		expect((berserk as any).damageAmount).to.equal(4);
	});

	it('can only be played by Barbarians', () => {
		const berserk = new BerserkCard();

		expect((berserk as any).permittedClassesAndTypes).to.deep.equal([BARBARIAN]);
	});

	it('Hits for 1 until attack misses', () => {
		const berserk = new BerserkCard();
		const player = new Gladiator({ name: 'player' });
		const target = new Minotaur({ name: 'target' });
		const before = (target as any).hp;

		const berserkProto = Object.getPrototypeOf(berserk);
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

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		const attackRoll = berserk.getAttackRoll(player);
		hitCheckStub.onFirstCall().returns({ attackRoll, success: true, strokeOfLuck: false, curseOfLoki: false });
		hitCheckStub.onSecondCall().returns({ attackRoll, success: true, strokeOfLuck: false, curseOfLoki: false });
		hitCheckStub.returns({ attackRoll, success: false, strokeOfLuck: false, curseOfLoki: false });

		return berserk.play(player, target, ring, ring.contestants).then(() => {
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
			expect((target as any).hp).to.equal(before - 2);
		});
	});

	describe('attackRollBonus', () => {
		it('takes iterations and intBonusFatigue into account', () => {
			const berserk = new BerserkCard();
			const player = new Gladiator({ name: 'player' });

			(player as any).xp = 100;
			expect((player as any).intModifier).to.equal(2);
			expect((player as any).dexModifier).to.equal(3);

			(berserk as any).intBonusFatigue = 0;
			expect((berserk as any).getAttackRollBonus(player)).to.equal((player as any).dexModifier);
			(berserk as any).iterations = 2;
			(berserk as any).intBonusFatigue = 0;
			expect((berserk as any).getAttackRollBonus(player)).to.equal(
				(player as any).dexModifier + (player as any).intModifier
			);
			(berserk as any).intBonusFatigue = 1;
			expect((berserk as any).getAttackRollBonus(player)).to.equal(
				(player as any).dexModifier + ((player as any).intModifier - 1)
			);
			(berserk as any).intBonusFatigue = 10;
			expect((berserk as any).getAttackRollBonus(player)).to.equal((player as any).dexModifier);
		});
	});

	describe('increaseFatigue', () => {
		it('calculates fatigue properly', () => {
			const berserk = new BerserkCard();

			expect((berserk as any).intBonusFatigue).to.equal(0);
			(berserk as any).increaseFatigue();
			expect((berserk as any).intBonusFatigue).to.equal(1);
		});
	});

	it('calls increaseFatigue each effectLoop iteration as expected', () => {
		const berserk = new BerserkCard();
		const player = new Gladiator({ name: 'player' });
		const target = new Minotaur({ name: 'target' });

		const berserkProto = Object.getPrototypeOf(berserk);
		const hitProto = Object.getPrototypeOf(berserkProto);
		const hitCheckStub = sinon.stub(hitProto, 'hitCheck');
		const increaseFatigueSpy = sinon.spy(berserkProto, 'increaseFatigue');
		const resetFatigueSpy = sinon.spy(berserkProto, 'resetFatigue');

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		const attackRoll = berserk.getAttackRoll(player);
		hitCheckStub.returns({ attackRoll, success: true, strokeOfLuck: false, curseOfLoki: false });
		hitCheckStub.onCall(4).returns({ attackRoll, success: true, strokeOfLuck: true, curseOfLoki: false });
		hitCheckStub.onCall(8).returns({ attackRoll, success: false, strokeOfLuck: false, curseOfLoki: false });

		expect((berserk as any).intBonusFatigue).to.equal(0);

		return berserk.play(player, target, ring, ring.contestants).then(() => {
			hitCheckStub.restore();
			increaseFatigueSpy.restore();
			resetFatigueSpy.restore();

			expect(resetFatigueSpy.callCount).to.equal(3);
			expect(increaseFatigueSpy.callCount).to.equal(7);
		});
	});

	it('resets intBonusFatigue after play', () => {
		const berserk = new BerserkCard();
		const player = new Gladiator({ name: 'player' });
		const target = new Minotaur({ name: 'target' });

		const berserkProto = Object.getPrototypeOf(berserk);
		const hitProto = Object.getPrototypeOf(berserkProto);
		const hitCheckStub = sinon.stub(hitProto, 'hitCheck');

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		const attackRoll = berserk.getAttackRoll(player);
		hitCheckStub.returns({ attackRoll, success: true, strokeOfLuck: false, curseOfLoki: false });
		hitCheckStub.onCall(4).returns({ attackRoll, success: false, strokeOfLuck: false, curseOfLoki: false });

		expect((berserk as any).intBonusFatigue).to.equal(0);

		return berserk.play(player, target, ring, ring.contestants).then(() => {
			hitCheckStub.restore();
			expect((berserk as any).intBonusFatigue).to.equal(0);
		});
	});

	it('Increases attack strength on strokeOfLuck', () => {
		const berserk = new BerserkCard();
		const player = new Gladiator({ name: 'player' });
		const target = new Minotaur({ name: 'target' });
		const before = (target as any).hp;

		const berserkProto = Object.getPrototypeOf(berserk);
		const hitProto = Object.getPrototypeOf(berserkProto);
		const baseProto = Object.getPrototypeOf(hitProto);
		const minotaurProto = Object.getPrototypeOf(target);
		const creatureProto = Object.getPrototypeOf(minotaurProto);

		const checkSuccessStub = sinon.stub(baseProto, 'checkSuccess').callsFake(
			() => ({ success: true, strokeOfLuck: false, curseOfLoki: false })
		);
		const hitCheckStub = sinon.stub(hitProto, 'hitCheck');
		const berserkEffectSpy = sinon.spy(berserkProto, 'effect');
		const hitEffectSpy = sinon.spy(hitProto, 'effect');
		const hitSpy = sinon.spy(creatureProto, 'hit');

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		const attackRoll = berserk.getAttackRoll(player);
		hitCheckStub.returns({ attackRoll, success: true, strokeOfLuck: true, curseOfLoki: false });
		hitCheckStub.onThirdCall().returns({ attackRoll, success: false, strokeOfLuck: false, curseOfLoki: false });

		return berserk.play(player, target, ring, ring.contestants).then(() => {
			hitCheckStub.restore();
			hitEffectSpy.restore();
			checkSuccessStub.restore();
			hitSpy.restore();
			berserkEffectSpy.restore();

			expect((target as any).hp).to.equal(before - 5);
			expect((berserk as any).damageAmount).to.equal(1);
		});
	});

	it('hits player and announces flavor narration on COMBO BREAKER', () => {
		const berserk = new BerserkCard();
		const player = new Gladiator({ name: 'player', hpVariance: 0 });
		const target = new Minotaur({ name: 'target', hpVariance: 0 });
		const before = (target as any).hp;
		const playerBeforeHp = (player as any).hp;

		const berserkProto = Object.getPrototypeOf(berserk);
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

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		const attackRoll = berserk.getAttackRoll(player);
		hitCheckStub.returns({ attackRoll, success: true, strokeOfLuck: false, curseOfLoki: false });
		hitCheckStub.onCall(4).returns({ attackRoll, success: false, strokeOfLuck: false, curseOfLoki: true });

		const narrations: string[] = [];
		berserk.on('narration', (_className: any, _monster: any, { narration }: any) => {
			narrations.push(narration);
		});

		return berserk.play(player, target, ring, ring.contestants).then(() => {
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
			expect(narrations).to.deep.equal(['COMBO BREAKER!  (Broke a 4 hit combo, 4 total damage)']);
			expect((player as any).hp).to.equal(playerBeforeHp - 1);
			expect((target as any).hp).to.equal(before - 4);
		});
	});
});
