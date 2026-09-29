import { expect } from 'chai';
import sinon from 'sinon';

import { HelmOfAweCard } from './helm-of-awe.js';
import { HitCard } from './hit.js';
import { HealCard } from './heal.js';
import { hydrateCard } from './helpers/hydrate.js';
import { armControlWard, CONTROL_WARD } from './helpers/control-ward.js';
import Dragon from '../monsters/dragon.js';
import Gladiator from '../monsters/gladiator.js';
import Minotaur from '../monsters/minotaur.js';
import { AWE_EFFECT } from '../constants/effect-types.js';
import { DRAGON } from '../constants/creature-types.js';

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

const isAwed = (monster: any) =>
	monster.encounterEffects.some((effect: any) => effect.effectType === AWE_EFFECT);

describe('./cards/helm-of-awe.ts Helm of Awe', () => {
	let dragon: any;
	let foe: any;
	let other: any;
	let ring: any;
	let contestants: any[];

	beforeEach(() => {
		dragon = new Dragon({ name: 'Ember', xp: 300 });
		foe = new Gladiator({ name: 'Tor' });
		other = new Minotaur({ name: 'Bram' });
		contestants = [dragon, foe, other].map(monster => ({ monster, character: {} }));
		ring = {
			contestants,
			encounterEffects: [],
			channelManager: { sendMessages: () => Promise.resolve() },
		};
		for (const { monster } of contestants) monster.startEncounter(ring);
	});

	// The shipped shape is cowering (roadmap 35); these first tests pin the penalty shape the
	// setting can still select, and the cower block below sets its own count.
	const shipped = { cower: HelmOfAweCard.cower, cowerCards: HelmOfAweCard.cowerCards };
	beforeEach(() => {
		HelmOfAweCard.cower = false;
	});
	afterEach(() => {
		sinon.restore();
		HelmOfAweCard.cower = shipped.cower;
		HelmOfAweCard.cowerCards = shipped.cowerCards;
	});

	it('ships cowering for two cards', () => {
		expect(shipped).to.deep.equal({ cower: true, cowerCards: 2 });
		HelmOfAweCard.cower = shipped.cower;
		expect(new HelmOfAweCard().stats).to.include('lose their next 2 cards (they do nothing)');
	});

	const attackModifiers = async (monster: any, target: any, plays: number) => {
		const rolls: any[] = [];
		const original = HitCard.prototype.getAttackRoll;
		sinon.stub(HitCard.prototype, 'getAttackRoll').callsFake(function (this: any, ...args: any[]) {
			const attackRoll = original.apply(this, args as any);
			rolls.push(attackRoll);
			return attackRoll;
		});
		sinon.stub(Math, 'random').returns(0.5);
		for (let i = 0; i < plays; i++) await new HitCard().play(monster, target, ring, contestants);
		return rolls.map(attackRoll => attackRoll.modifier);
	};

	it('is a level 2 rare Dragon card, hydratable, and not for a Minotaur', () => {
		expect(HelmOfAweCard.permittedClassesAndTypes).to.deep.equal([DRAGON]);
		expect(HelmOfAweCard.level).to.equal(2);
		expect(HelmOfAweCard.notForSale).to.equal(true);
		expect(dragon.canHoldCard(HelmOfAweCard)).to.equal(true);
		expect(other.canHoldCard(HelmOfAweCard)).to.equal(false);
		expect(new HelmOfAweCard().stats).to.include('No damage');
		expect(hydrateCard(JSON.parse(JSON.stringify(new HelmOfAweCard())))).to.be.instanceOf(HelmOfAweCard);
	});

	it('targets every opponent and leaves allies alone', () => {
		expect(new HelmOfAweCard().getTargets(dragon, foe, ring, contestants)).to.deep.equal([foe, other]);
		(contestants[0] as any).team = 'north';
		(contestants[1] as any).team = 'north';
		(contestants[2] as any).team = 'south';
		expect(new HelmOfAweCard().getTargets(dragon, foe, ring, contestants)).to.deep.equal([other]);
	});

	it('awes each opponent that fails the save, and only that one, with no damage', async () => {
		const card = new HelmOfAweCard();
		const save = sinon.stub(card, 'getSaveRoll');
		save.onFirstCall().returns(fakeRoll(2));
		save.onSecondCall().returns(fakeRoll(20));
		const foeHit = sinon.spy(foe, 'hit');

		await card.play(dragon, foe, ring, contestants);

		expect(isAwed(foe)).to.equal(true);
		expect(isAwed(other)).to.equal(false);
		expect(foeHit).not.to.have.been.called;
	});

	it('rolls against 10 + the dragon\'s int modifier', async () => {
		const card = new HelmOfAweCard();
		const rolled: any[] = [];
		card.on('rolled', (_c: string, _card: any, payload: any) => rolled.push(payload));
		sinon.stub(card, 'getSaveRoll').returns(fakeRoll(2));

		await card.effect(dragon, foe, ring, contestants);

		expect(rolled[0].vs).to.equal(10 + dragon.intModifier);
	});

	it('takes the penalty off exactly aweCards of the awed monster\'s plays', async () => {
		const card = new HelmOfAweCard();
		sinon.stub(card, 'getSaveRoll').returns(fakeRoll(2));
		await card.effect(dragon, foe, ring, contestants);

		const modifiers = await attackModifiers(foe, dragon, HelmOfAweCard.aweCards + 2);

		const base = modifiers[modifiers.length - 1];
		expect(modifiers.slice(0, HelmOfAweCard.aweCards)).to.deep.equal(
			Array(HelmOfAweCard.aweCards).fill(base - HelmOfAweCard.awePenalty)
		);
		expect(modifiers[HelmOfAweCard.aweCards]).to.equal(base);
		expect(isAwed(foe)).to.equal(false);
	});

	it('spends an awed play on a card that does not roll to hit', async () => {
		const card = new HelmOfAweCard();
		sinon.stub(card, 'getSaveRoll').returns(fakeRoll(2));
		await card.effect(dragon, foe, ring, contestants);

		await new HealCard().play(foe, foe, ring, contestants);
		await new HealCard().play(foe, foe, ring, contestants);
		await new HealCard().play(foe, foe, ring, contestants);

		expect(isAwed(foe)).to.equal(false);
	});

	it('does nothing on a successful save', async () => {
		const card = new HelmOfAweCard();
		sinon.stub(card, 'getSaveRoll').returns(fakeRoll(20));
		await card.effect(dragon, foe, ring, contestants);
		expect(isAwed(foe)).to.equal(false);
	});

	it('refreshes the count when awed again, without stacking the penalty', async () => {
		const card = new HelmOfAweCard();
		sinon.stub(card, 'getSaveRoll').returns(fakeRoll(2));
		await card.effect(dragon, foe, ring, contestants);
		await new HealCard().play(foe, foe, ring, contestants);
		await card.effect(dragon, foe, ring, contestants);

		expect(foe.encounterEffects.filter((e: any) => e.effectType === AWE_EFFECT)).to.have.length(1);

		const modifiers = await attackModifiers(foe, dragon, HelmOfAweCard.aweCards + 1);
		const base = modifiers[modifiers.length - 1];
		expect(modifiers.slice(0, HelmOfAweCard.aweCards)).to.deep.equal(
			Array(HelmOfAweCard.aweCards).fill(base - HelmOfAweCard.awePenalty)
		);
	});

	it('is cancelled by Horn of Proof\'s ward, which is then spent', async () => {
		armControlWard(foe);
		const card = new HelmOfAweCard();
		sinon.stub(card, 'getSaveRoll').returns(fakeRoll(2));
		const lines: string[] = [];
		card.on('narration', (_c: string, _card: any, payload: any) => lines.push(payload.narration));

		await card.effect(dragon, foe, ring, contestants);

		expect(isAwed(foe)).to.equal(false);
		expect(foe.encounterModifiers[CONTROL_WARD]).to.equal('spent');
		expect(lines.join(' ')).to.include('will not be awed.');
	});

	it('is gone after the encounter ends', async () => {
		const card = new HelmOfAweCard();
		sinon.stub(card, 'getSaveRoll').returns(fakeRoll(2));
		await card.effect(dragon, foe, ring, contestants);
		foe.endEncounter();
		expect(isAwed(foe)).to.equal(false);
	});
	describe('with the cower setting on', () => {
		beforeEach(() => {
			HelmOfAweCard.cower = true;
			HelmOfAweCard.cowerCards = 1;
		});

		it('says so in its rules text', () => {
			expect(new HelmOfAweCard().stats).to.include('lose their next card');
		});

		it('makes a failed save lose exactly the next card', async () => {
			const card = new HelmOfAweCard();
			sinon.stub(card, 'getSaveRoll').returns(fakeRoll(2));
			await card.effect(dragon, foe, ring, contestants);
			expect(isAwed(foe)).to.equal(true);

			const dragonHit = sinon.spy(dragon, 'hit');
			const first = await new HitCard().play(foe, dragon, ring, contestants);
			expect(first).to.equal(true);
			expect(dragonHit).not.to.have.been.called;
			expect(isAwed(foe)).to.equal(false);

			// The second card is a real play again, with no attack penalty.
			const modifiers = await attackModifiers(foe, dragon, 2);
			expect(modifiers).to.have.length(2);
			expect(modifiers[0]).to.equal(modifiers[1]);
		});

		it('does not stack when awed again while cowering', async () => {
			const card = new HelmOfAweCard();
			sinon.stub(card, 'getSaveRoll').returns(fakeRoll(2));
			await card.effect(dragon, foe, ring, contestants);
			await card.effect(dragon, foe, ring, contestants);
			expect(foe.encounterEffects.filter((e: any) => e.effectType === AWE_EFFECT)).to.have.length(1);

			await new HitCard().play(foe, dragon, ring, contestants);
			expect(isAwed(foe)).to.equal(false);
		});

		it('does nothing on a successful save', async () => {
			const card = new HelmOfAweCard();
			sinon.stub(card, 'getSaveRoll').returns(fakeRoll(20));
			await card.effect(dragon, foe, ring, contestants);
			expect(isAwed(foe)).to.equal(false);
		});

		it('is cancelled by the ward', async () => {
			armControlWard(foe);
			const card = new HelmOfAweCard();
			sinon.stub(card, 'getSaveRoll').returns(fakeRoll(2));
			await card.effect(dragon, foe, ring, contestants);
			expect(isAwed(foe)).to.equal(false);
			expect(foe.encounterModifiers[CONTROL_WARD]).to.equal('spent');
		});

		it('leaves allies untouched', () => {
			(contestants[0] as any).team = 'north';
			(contestants[1] as any).team = 'north';
			(contestants[2] as any).team = 'south';
			expect(new HelmOfAweCard().getTargets(dragon, foe, ring, contestants)).to.deep.equal([other]);
		});
	});

	describe('with the hold setting on', () => {
		const settings = {
			hold: HelmOfAweCard.hold,
			holdFatigue: HelmOfAweCard.holdFatigue,
			holdFirstCardLost: HelmOfAweCard.holdFirstCardLost,
			fleeOnLoki: HelmOfAweCard.fleeOnLoki,
		};
		beforeEach(() => {
			HelmOfAweCard.cower = true;
			HelmOfAweCard.hold = true;
		});
		afterEach(() => {
			Object.assign(HelmOfAweCard, settings);
		});

		// Awes `foe` with the save rolls given in order, and records each save's DC.
		const aweWith = async (naturals: number[]) => {
			const card = new HelmOfAweCard();
			const save = sinon.stub(card, 'getSaveRoll');
			naturals.forEach((natural, i) => save.onCall(i).returns(fakeRoll(natural)));
			const dcs: number[] = [];
			card.on('rolled', (_c: string, _card: any, { vs }: any) => dcs.push(vs));
			await card.effect(dragon, foe, ring, contestants);
			return { card, dcs };
		};
		const foeActs = async () => {
			const effect = sinon.spy(HitCard.prototype, 'effect');
			await new HitCard().play(foe, dragon, ring, contestants);
			const acted = effect.called;
			effect.restore();
			return acted;
		};

		it('says so in its rules text', () => {
			expect(new HelmOfAweCard().stats).to.include('they roll again (3 easier for each turn already awed)');
		});

		it('costs the next card, then a card for each failed save, until a save succeeds', async () => {
			const { dcs } = await aweWith([2, 2, 2, 20]);
			expect(await foeActs()).to.equal(false);
			expect(await foeActs()).to.equal(false);
			expect(await foeActs()).to.equal(false);
			expect(await foeActs()).to.equal(true);
			expect(isAwed(foe)).to.equal(false);
			const dc = 10 + dragon.intModifier;
			// The awing save, then the recovery saves, each 3 easier than the last.
			expect(dcs).to.deep.equal([dc, dc, dc - 3, dc - 6]);
		});

		it('with holdFirstCardLost off, the first recovery save comes at once', async () => {
			HelmOfAweCard.holdFirstCardLost = false;
			await aweWith([2, 20]);
			expect(await foeActs()).to.equal(true);
			expect(isAwed(foe)).to.equal(false);
		});

		it('never refreshes: a second helm on a cowering monster rolls nothing', async () => {
			await aweWith([2]);
			const again = new HelmOfAweCard();
			const save = sinon.stub(again, 'getSaveRoll');
			await again.effect(dragon, foe, ring, contestants);
			expect(save).not.to.have.been.called;
			expect(foe.encounterEffects.filter((e: any) => e.effectType === AWE_EFFECT)).to.have.length(1);
		});

		it('ends when the dragon dies', async () => {
			await aweWith([2]);
			dragon.dead = true;
			expect(await foeActs()).to.equal(true);
			expect(isAwed(foe)).to.equal(false);
		});

		it('with fleeOnLoki flee, a natural 1 sends the monster from the ring', async () => {
			HelmOfAweCard.fleeOnLoki = 'flee';
			await aweWith([2, 1]);
			await foeActs();
			await new HitCard().play(foe, dragon, ring, contestants);
			expect(foe.fled).to.equal(true);
			expect(isAwed(foe)).to.equal(false);
		});

		it('with fleeOnLoki attempt, the monster must also make a flee roll', async () => {
			HelmOfAweCard.fleeOnLoki = 'attempt';
			const { card } = await aweWith([2, 1]);
			sinon.stub(card, 'getFleeRoll').returns(fakeRoll(3));
			await foeActs();
			expect(await foeActs()).to.equal(false);
			expect(foe.fled).to.equal(false);
			expect(isAwed(foe)).to.equal(true);
		});

		it('frightens a boss away like anyone else', async () => {
			HelmOfAweCard.fleeOnLoki = 'flee';
			foe.setOptions({ isBoss: true });
			await aweWith([2, 1]);
			await foeActs();
			await new HitCard().play(foe, dragon, ring, contestants);
			expect(foe.fled).to.equal(true);
		});

		it('with fleeOnLoki healthy, a healthy monster tries to flee and a bloodied one cowers', async () => {
			HelmOfAweCard.fleeOnLoki = 'healthy';
			const { card } = await aweWith([2, 1]);
			const flee = sinon.stub(card, 'getFleeRoll').returns(fakeRoll(15));
			foe.hp = 1;
			await foeActs();
			expect(await foeActs()).to.equal(false);
			expect(flee).not.to.have.been.called;
			expect(foe.fled).to.equal(false);
		});

		it('with fleeOnLoki healthy, a monster at full hp runs on a good flee roll', async () => {
			HelmOfAweCard.fleeOnLoki = 'healthy';
			const { card } = await aweWith([2, 1]);
			sinon.stub(card, 'getFleeRoll').returns(fakeRoll(15));
			await foeActs();
			await new HitCard().play(foe, dragon, ring, contestants);
			expect(foe.fled).to.equal(true);
		});

		it('is still cancelled by the ward', async () => {
			armControlWard(foe);
			await aweWith([2]);
			expect(isAwed(foe)).to.equal(false);
		});
	});
});
