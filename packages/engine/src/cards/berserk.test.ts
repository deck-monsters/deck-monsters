import { expect } from 'chai';
import sinon from 'sinon';

import { BerserkCard } from './berserk.js';
import { fromBeyond } from './hit.js';
import Gladiator from '../monsters/gladiator.js';
import Minotaur from '../monsters/minotaur.js';
import { BARBARIAN } from '../constants/creature-classes.js';

describe('./cards/berserk.ts', () => {
	it('can be instantiated with defaults', () => {
		const berserk = new BerserkCard();

		expect(berserk).to.be.an.instanceof(BerserkCard);
		expect((berserk as any).bigFirstHit).to.be.false;
		expect((berserk as any).damageAmount).to.equal(1);
		expect(berserk.stats).to.equal(
			'Hit: 1d20 + dex vs ac on first hit\nthen also + int bonus (fatigued by 1 each subsequent hit) until you miss.\nOnce the combo has done half the target\'s max hp, it shows off for up to 3 more swings: no damage, but a 1 still backfires.\n1 damage per hit.\n\nStroke of luck increases damage per hit by 1.'
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
			expect(narrations).to.deep.equal(['COMBO BREAKER! (Broke a 4 hit combo, 4 total damage)']);
			expect((player as any).hp).to.equal(playerBeforeHp - 1);
			expect((target as any).hp).to.equal(before - 4);
		});
	});

	// Bug 259 (fight #137): a stolen Berserk against a pinned, 3-hp target swung 282 times,
	// claimed 4,927 damage after dealing 24, and the fallen target's fling-back killed the
	// attacker. These pin the three fixes with every swing a hit (as advantage made it).
	describe('a combo that keeps landing (bug 259)', () => {
		const setUp = (targetHp: number) => {
			const berserk = new BerserkCard();
			const player = new Gladiator({ name: 'player', hpVariance: 0 });
			const target = new Minotaur({ name: 'target', hpVariance: 0 });
			(target as any).hp = targetHp;
			const hitProto = Object.getPrototypeOf(Object.getPrototypeOf(berserk));
			const hitCheckStub = sinon.stub(hitProto, 'hitCheck');
			const attackRoll = berserk.getAttackRoll(player);
			hitCheckStub.returns({ attackRoll, success: true, strokeOfLuck: false, curseOfLoki: false });
			const ring: any = {
				contestants: [{ monster: player }, { monster: target }],
				channelManager: { sendMessages: () => Promise.resolve() },
			};
			const narrations: string[] = [];
			berserk.on('narration', (_c: any, _m: any, { narration }: any) => narrations.push(narration));
			return { berserk, player, target, hitCheckStub, attackRoll, ring, narrations };
		};

		it('shows off for three swings after HUMILIATION and reports only the damage dealt', async () => {
			const { berserk, player, target, hitCheckStub, ring, narrations } = setUp(3);
			const half = Math.floor((target as any).maxHp / 2);
			try {
				await berserk.play(player, target, ring, ring.contestants);
			} finally {
				hitCheckStub.restore();
			}

			// The opener, `half` combo hits, the HUMILIATION swing, then three showboats.
			expect(hitCheckStub.callCount).to.equal(half + 5);
			expect((target as any).hp).to.equal(3 - 1 - half);
			expect(narrations).to.deep.equal([
				'HUMILIATION! Target has taken all one combo can dish out. Player keeps swinging just to show off: no more damage, but a natural 1 still backfires.',
				'Player flicks the ear of Target. No damage, all style.',
				'Player pats the head of Target. No damage, all style.',
				'Player flexes over Target. No damage, all style.',
				'Player takes a bow.',
				`HUMILIATION! ULTIMATE COMBO! ${half + 1} HITS (${half + 1} total damage).`,
			]);
		});

		it('a natural 1 while showing off at a living target still backfires', async () => {
			const { berserk, player, target, hitCheckStub, attackRoll, ring, narrations } = setUp(100);
			const half = Math.floor((target as any).maxHp / 2);
			// Opener, `half` hits, the HUMILIATION swing, one showboat, then a natural 1.
			hitCheckStub.onCall(half + 3).returns({ attackRoll, success: false, strokeOfLuck: false, curseOfLoki: true });
			const playerBefore = (player as any).hp;
			try {
				await berserk.play(player, target, ring, ring.contestants);
			} finally {
				hitCheckStub.restore();
			}

			expect((target as any).dead).to.be.false;
			expect((player as any).hp).to.equal(playerBefore - 1);
			expect(narrations[0]).to.match(/no more damage, but a natural 1 still backfires\.$/);
			expect(narrations.at(-1)).to.equal(
				`COMBO BREAKER! Pride goes before a fall: Target catches Player showing off. (Broke a ${half + 1} hit combo, ${half + 1} total damage)`
			);
		});

		it('a natural 1 at a fallen target: the body strikes back, and the roll line says how', async () => {
			const { berserk, player, target, hitCheckStub, attackRoll, ring, narrations } = setUp(2);
			hitCheckStub.onCall(3).returns({ attackRoll, success: false, strokeOfLuck: false, curseOfLoki: true });
			const playerHit = sinon.spy(player, 'hit');
			try {
				await berserk.play(player, target, ring, ring.contestants);
			} finally {
				hitCheckStub.restore();
			}

			expect((target as any).dead).to.be.true;
			expect(playerHit.callCount).to.equal(1);
			expect(playerHit.firstCall.args[1]).to.equal(target);
			expect(narrations).to.deep.equal(['COMBO BREAKER! (Broke a 3 hit combo, 3 total damage)']);
			expect(fromBeyond(player, target)).to.match(/^Player rolled a 1/);
		});
	});
});
