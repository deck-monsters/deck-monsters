import { expect } from 'chai';
import sinon from 'sinon';

import { ATTACK_PHASE } from '../constants/phases.js';
import { BlinkCard } from './blink.js';
import { TestCard } from './test.js';
import Basilisk from '../monsters/basilisk.js';
import WeepingAngel from '../monsters/weeping-angel.js';
import { WEEPING_ANGEL } from '../constants/creature-types.js';

describe('./cards/blink.ts', () => {
	it('can be instantiated with defaults', () => {
		const blink = new BlinkCard();

		expect(blink).to.be.an.instanceof(BlinkCard);
		expect((blink as any).energyToStealDice).to.equal('1d4');
		expect((blink as any).turnsToBlink).to.equal(1);
		expect((blink as any).curseAmountDice).to.equal('4d4');
		expect((blink as any).cursedProp).to.equal('xp');
		expect((blink as any).hasChanceToHit).to.be.false;
		expect(blink.stats).to.equal(
			"1d20 vs opponent's int. They are removed from the battle (and can not be targeted).\nOn what would have been their next turn, if you are still alive you drain 1d4 hp and 4d4 xp"
		);
	});

	it('can be instantiated with options', () => {
		const blink = new BlinkCard({
			energyToStealDice: '2d4',
			turnsToBlink: 2,
			curseAmountDice: '4d6',
			cursedProp: 'ac',
			hasChanceToHit: true,
		} as any);

		expect(blink).to.be.an.instanceof(BlinkCard);
		expect((blink as any).energyToStealDice).to.equal('2d4');
		expect((blink as any).turnsToBlink).to.equal(2);
		expect((blink as any).curseAmountDice).to.equal('4d6');
		expect((blink as any).cursedProp).to.equal('ac');
		expect((blink as any).hasChanceToHit).to.be.true;
		expect(blink.stats).to.equal(
			"1d20 vs opponent's int. They are removed from the battle (and can not be targeted).\nOn what would have been their next turn, if you are still alive you drain 2d4 hp and 4d6 ac"
		);
	});

	it('can only be played by WeepingAngels', () => {
		const blink = new BlinkCard();

		expect((blink as any).permittedClassesAndTypes).to.deep.equal([WEEPING_ANGEL]);
	});

	it('blinks target on hit', () => {
		const blink = new BlinkCard();
		const player = new WeepingAngel({ name: 'player' });
		const target = new Basilisk({ name: 'target' });

		const blinkProto = Object.getPrototypeOf(blink);
		const curseProto = Object.getPrototypeOf(blinkProto);

		const attackRollStub = sinon.stub(curseProto, 'getAttackRoll');

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		attackRollStub.returns({
			primaryDice: '1d20',
			result: 19,
			naturalRoll: { rolled: [19], result: 19 },
			bonusResult: 0,
			modifier: 0,
		});

		return blink.play(player, target, ring, ring.contestants).then(() => {
			attackRollStub.restore();
			expect((target as any).encounterEffects.length).to.equal(1);
		});
	});

	it('drains hp and xp on blinked target\'s turn', () => {
		const blink = new BlinkCard();
		const card = new TestCard();
		const player = new WeepingAngel({ name: 'player' });
		(player as any).hp = 1;
		const target = new Basilisk({ name: 'target' });
		(target as any).xp = 100;
		const targetBeforeHP = (target as any).hp;
		const targetBeforeXP = (target as any).xp;
		const playerBeforeHP = (player as any).hp;
		const playerBeforeXP = (player as any).xp;

		const blinkProto = Object.getPrototypeOf(blink);
		const curseProto = Object.getPrototypeOf(blinkProto);
		const basiliskProto = Object.getPrototypeOf(target);
		const creatureProto = Object.getPrototypeOf(basiliskProto);

		const attackRollStub = sinon.stub(curseProto, 'getAttackRoll');
		const hitSpy = sinon.spy(creatureProto, 'hit');

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		attackRollStub.returns({
			primaryDice: '1d20',
			result: 19,
			naturalRoll: { rolled: [19], result: 19 },
			bonusResult: 0,
			modifier: 0,
		});

		return blink
			.play(player, target, ring, ring.contestants)
			.then(() => (target as any).encounterEffects[0]({ card, phase: ATTACK_PHASE, player: target, target: player }))
			.then(() => {
				attackRollStub.restore();
				hitSpy.restore();

				expect(hitSpy.callCount).to.equal(1);
				expect((target as any).hp).to.be.below(targetBeforeHP);
				expect((player as any).hp).to.be.above(playerBeforeHP);
				expect((target as any).xp).to.be.below(targetBeforeXP);
				expect((player as any).xp).to.be.above(playerBeforeXP);
			});
	});

	it('blinked target is unable to be hit while blinked', () => {
		const blink = new BlinkCard();
		const card = new TestCard();
		const player = new WeepingAngel({ name: 'player' });
		const target = new Basilisk({ name: 'target' });

		const blinkProto = Object.getPrototypeOf(blink);
		const curseProto = Object.getPrototypeOf(blinkProto);
		const basiliskProto = Object.getPrototypeOf(target);
		const creatureProto = Object.getPrototypeOf(basiliskProto);

		const attackRollStub = sinon.stub(curseProto, 'getAttackRoll');
		const hitSpy = sinon.spy(creatureProto, 'hit');

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		attackRollStub.returns({
			primaryDice: '1d20',
			result: 19,
			naturalRoll: { rolled: [19], result: 19 },
			bonusResult: 0,
			modifier: 0,
		});

		(card as any).targets = [target];
		expect((card as any).played).to.be.undefined;
		return card
			.play(player, target, ring, ring.contestants)
			.then(() => expect((card as any).played).to.equal(1))
			.then(() => blink.play(player, target, ring, ring.contestants))
			.then(() => expect((target as any).encounterEffects.length).to.equal(1))
			.then(() => card.play(player, target, ring, ring.contestants))
			.then(() => {
				attackRollStub.restore();
				hitSpy.restore();

				expect((card as any).played).to.equal(1);
			});
	});

	it('player can still play cards that only affect themselves while opponent is blinked', () => {
		const blink = new BlinkCard();
		const card = new TestCard();
		const player = new WeepingAngel({ name: 'player' });
		const target = new Basilisk({ name: 'target' });

		const blinkProto = Object.getPrototypeOf(blink);
		const curseProto = Object.getPrototypeOf(blinkProto);
		const basiliskProto = Object.getPrototypeOf(target);
		const creatureProto = Object.getPrototypeOf(basiliskProto);

		const attackRollStub = sinon.stub(curseProto, 'getAttackRoll');
		const hitSpy = sinon.spy(creatureProto, 'hit');

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		attackRollStub.returns({
			primaryDice: '1d20',
			result: 19,
			naturalRoll: { rolled: [19], result: 19 },
			bonusResult: 0,
			modifier: 0,
		});

		(card as any).targets = [player];
		expect((card as any).played).to.be.undefined;
		return blink
			.play(player, target, ring, ring.contestants)
			.then(() => expect((target as any).encounterEffects.length).to.equal(1))
			.then(() => card.play(player, target, ring, ring.contestants))
			.then(() => {
				attackRollStub.restore();
				hitSpy.restore();

				expect((card as any).played).to.equal(1);
			});
	});
});
