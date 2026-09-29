import { expect } from 'chai';
import sinon from 'sinon';

import { ImmobilizeCard } from '../immobilize.js';
import { HitCard } from '../hit.js';
import { LuckyStrike as LuckyStrikeCard } from '../lucky-strike.js';
import { DissonantVoiceCard } from '../dissonant-voice.js';
import { HelmOfAweCard } from '../helm-of-awe.js';
import { PIN_RULES, isPinned, advantageAgainstPinned } from './pinned.js';
import { addRollMode, rollWithModes } from './roll-mode.js';
import Gladiator from '../../monsters/gladiator.js';
import Minotaur from '../../monsters/minotaur.js';
import Basilisk from '../../monsters/basilisk.js';
import Dragon from '../../monsters/dragon.js';
import Unicorn from '../../monsters/unicorn.js';

const fakeRoll = (natural: number, modifier = 0) => ({
	primaryDice: '1d20',
	bonusDice: undefined,
	result: natural + modifier,
	naturalRoll: { result: natural },
	bonusResult: 0,
	modifier,
	strokeOfLuck: natural === 20,
	curseOfLoki: natural === 1,
});

describe('./cards/helpers/pinned.ts pinned monsters are easier to hit', () => {
	let holder: any;
	let held: any;
	let bystander: any;
	let ring: any;
	let contestants: any[];

	beforeEach(() => {
		holder = new Basilisk({ name: 'Sss' });
		held = new Gladiator({ name: 'Tor' });
		bystander = new Minotaur({ name: 'Bram' });
		contestants = [holder, held, bystander].map(monster => ({ monster, character: {} }));
		ring = { contestants, encounterEffects: [], channelManager: { sendMessages: () => Promise.resolve() } };
		for (const { monster } of contestants) monster.startEncounter(ring);
	});

	afterEach(() => {
		sinon.restore();
		PIN_RULES.advantage = true;
	});

	const hold = async () => {
		await new ImmobilizeCard().immobilize(holder, held, ring, contestants);
		expect(isPinned(held)).to.equal(true);
	};

	// Plays a Hit from `attacker` at `target` with the given naturals, and returns the roll used.
	const attackWith = async (attacker: any, target: any, naturals: number[]) => {
		const rolls = naturals.map(n => fakeRoll(n));
		const stub = sinon.stub(HitCard.prototype, 'getAttackRoll').callsFake(() => rolls.shift() as any);
		const hitCheck = sinon.spy(HitCard.prototype, 'hitCheck');
		await new HitCard().play(attacker, target, ring, contestants);
		const used = hitCheck.firstCall.returnValue.attackRoll;
		const calls = stub.callCount;
		stub.restore();
		hitCheck.restore();
		return { used, calls };
	};

	it('gives attacks against a held monster advantage: two rolls, the better kept', async () => {
		await hold();
		const { used, calls } = await attackWith(bystander, held, [4, 15]);
		expect(calls).to.equal(2);
		expect(used.result).to.equal(15);
	});

	it('leaves attacks against anyone else alone', async () => {
		await hold();
		const { calls } = await attackWith(holder, bystander, [4, 15]);
		expect(calls).to.equal(1);
	});

	it('keeps a natural 20 the best roll and a natural 1 the worst', async () => {
		await hold();
		expect((await attackWith(bystander, held, [20, 19])).used.strokeOfLuck).to.equal(true);
		expect((await attackWith(bystander, held, [1, 2])).used.result).to.equal(2);
	});

	it('ends with the hold', async () => {
		await hold();
		held.encounterEffects = held.encounterEffects.filter((e: any) => e.effectType !== 'ImmobilizeEffect');
		expect(isPinned(held)).to.equal(false);
		expect((await attackWith(bystander, held, [4, 15])).calls).to.equal(1);
	});

	it('can be switched off for the harness before/after', async () => {
		await hold();
		PIN_RULES.advantage = false;
		expect((await attackWith(bystander, held, [4, 15])).calls).to.equal(1);
	});

	it('cancels with Dissonant Voice\'s disadvantage to a single roll, whichever came first', async () => {
		await hold();
		await new DissonantVoiceCard().effect(holder, bystander, ring);
		const { used, calls } = await attackWith(bystander, held, [4, 15]);
		expect(calls).to.equal(1);
		expect(used.result).to.equal(4);
	});

	it('does not stack with Lucky Strike, whose two rolls already are advantage', async () => {
		await hold();
		const stub = sinon.stub(LuckyStrikeCard.prototype, 'getAttackRoll').callsFake(() => fakeRoll(10) as any);
		await new LuckyStrikeCard().play(bystander, held, ring, contestants);
		expect(stub.callCount).to.equal(2);
	});

	it('lets a pin and a rattle cancel on Lucky Strike too: one roll each, not four', async () => {
		await hold();
		await new DissonantVoiceCard().effect(holder, bystander, ring);
		const stub = sinon.stub(LuckyStrikeCard.prototype, 'getAttackRoll').callsFake(() => fakeRoll(10) as any);
		await new LuckyStrikeCard().play(bystander, held, ring, contestants);
		expect(stub.callCount).to.equal(2);
	});

	it('finds the target of a hit a card picks inside its own effect (Enthrall)', async () => {
		// Enthrall names only its caster as a target and holds or hits each opponent from inside
		// its effect, so the advantage must be decided at the roll, not from the outer target.
		await hold();
		const rolls = [fakeRoll(4), fakeRoll(15)];
		const card: any = {
			getAttackRoll: () => rolls.shift(),
			hitCheck(player: any, target: any) {
				return { attackRoll: this.getAttackRoll(player), target };
			},
			async effect(player: any) {
				return this.hitCheck(player, held);
			},
		};
		advantageAgainstPinned(held, card);
		const { attackRoll } = await card.effect(bystander, bystander);
		expect(attackRoll.result).to.equal(15);
		expect(rolls).to.have.length(0);
	});

	it("gives a companion's own d20 (the donkey's kick) the pin's advantage, but not its player's rattle", async () => {
		await hold();
		const card: any = {};
		advantageAgainstPinned(held, card);
		addRollMode(card, 'disadvantage');
		const once = sinon.stub().onFirstCall().returns(fakeRoll(4)).onSecondCall().returns(fakeRoll(15));
		expect(rollWithModes(card, bystander, held, once, { targetOnly: true }).result).to.equal(15);
		expect(once.callCount).to.equal(2);
		// The player's own extra blow (Tail Lash's tail) takes both, which cancel.
		const tail = sinon.stub().returns(fakeRoll(9));
		expect(rollWithModes(card, bystander, held, tail).result).to.equal(9);
		expect(tail.callCount).to.equal(1);
	});

	it('treats a monster awed by Helm of Awe as pinned', async () => {
		const dragon = new Dragon({ name: 'Ember', xp: 300 });
		dragon.startEncounter(ring);
		contestants.push({ monster: dragon, character: {} });
		const helm = new HelmOfAweCard();
		sinon.stub(helm, 'getSaveRoll').returns(fakeRoll(2));
		await helm.effect(dragon, bystander, ring, contestants);
		expect(isPinned(bystander)).to.equal(true);
		expect((await attackWith(holder, bystander, [4, 15])).calls).to.equal(2);
	});

	it('counts a stuck horn (Sticketh) as a pin: the unicorn is held by its own horn', () => {
		const unicorn = new Unicorn({ name: 'Nola' });
		unicorn.encounterEffects = [Object.assign(() => undefined, { effectType: 'ImmobilizeEffect' })];
		expect(isPinned(unicorn)).to.equal(true);
	});
});

describe('./cards/helpers/roll-mode.ts', () => {
	const cardRolling = (naturals: number[]) => {
		const card: any = { getAttackRoll: () => fakeRoll(naturals.shift()!) };
		return card;
	};

	it('rolls once with no mode, or with one advantage and one disadvantage', () => {
		const card = cardRolling([7, 18]);
		addRollMode(card, 'advantage');
		addRollMode(card, 'disadvantage');
		expect(card.getAttackRoll().result).to.equal(7);
	});

	it('keeps the better with advantage and the worse with disadvantage, and undoes', () => {
		const card = cardRolling([7, 18, 7, 18, 9]);
		const undo = addRollMode(card, 'advantage');
		expect(card.getAttackRoll().result).to.equal(18);
		undo();
		const undoDis = addRollMode(card, 'disadvantage');
		expect(card.getAttackRoll().result).to.equal(7);
		undoDis();
		expect(card.getAttackRoll().result).to.equal(9);
	});

	it('does nothing to a card that does not roll to hit', () => {
		const card: any = {};
		expect(() => addRollMode(card, 'advantage')()).not.to.throw();
		expect(card.getAttackRoll).to.equal(undefined);
	});
});
