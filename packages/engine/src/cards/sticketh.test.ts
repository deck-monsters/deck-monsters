import { expect } from 'chai';
import sinon from 'sinon';

import { StickethCard } from './sticketh.js';
import { HitCard } from './hit.js';
import { hydrateCard } from './helpers/hydrate.js';
import { getMinimumDeck } from './helpers/deck.js';
import Unicorn from '../monsters/unicorn.js';
import Minotaur from '../monsters/minotaur.js';
import WeepingAngel from '../monsters/weeping-angel.js';
import { UNICORN } from '../constants/creature-types.js';

// A roll object in the shape `chance.roll` returns, pinned to a natural result.
const fakeRoll = (natural: number, modifier = 0, sides = 20) => ({
	primaryDice: `1d${sides}`,
	bonusDice: undefined,
	result: natural + modifier,
	naturalRoll: { result: natural },
	bonusResult: 0,
	modifier,
	strokeOfLuck: natural === sides,
	curseOfLoki: natural === 1,
});

describe('./cards/sticketh.ts Sticketh', () => {
	let unicorn: any;
	let foe: any;
	let ring: any;
	let contestants: any[];

	beforeEach(() => {
		unicorn = new Unicorn({ name: 'Nola', gender: 'androgynous' });
		foe = new Minotaur({ name: 'Bram' });
		contestants = [{ monster: unicorn }, { monster: foe }];
		ring = {
			contestants,
			encounterEffects: [],
			channelManager: { sendMessages: () => Promise.resolve() },
		};
		unicorn.startEncounter(ring);
		foe.startEncounter(ring);
	});

	afterEach(() => sinon.restore());

	const isStuck = (monster: any) =>
		monster.encounterEffects.some((effect: any) => effect.effectType === 'ImmobilizeEffect');

	it('keeps its exact title and Unicorn-only permissions', () => {
		const card = new StickethCard();

		expect(card.cardType).to.equal('Sticketh');
		expect(StickethCard.permittedClassesAndTypes).to.deep.equal([UNICORN]);
		expect(StickethCard.level).to.equal(0);
		expect(StickethCard.notForSale).to.equal(true);
		expect((card as any).damageDice).to.equal('1d10');
		expect(unicorn.canHoldCard(StickethCard)).to.equal(true);
		expect(foe.canHoldCard(StickethCard)).to.equal(false);
		// Weeping Angel is also a Cleric; the permission is by type, not class.
		expect(new WeepingAngel().canHoldCard(StickethCard)).to.equal(false);
	});

	it('explains the charge and the stick-fast risk in its stats', () => {
		const { stats } = new StickethCard();

		expect(stats).to.include('Charge: 1d20 +1 vs ac / Damage: 1d10');
		expect(stats).to.include('1d20 + str vs the target\'s dex');
		expect(stats).to.include('stuck fast');
		expect(stats).not.to.include('Opponent breaks free');
	});

	it('rolls the charge with a +1 bonus over a plain hit', () => {
		const card = new StickethCard();
		const hit = new HitCard();
		sinon.stub(Math, 'random').returns(0.5);

		const charge = card.getAttackRoll(unicorn);
		const plain = hit.getAttackRoll(unicorn);

		expect(charge.modifier).to.equal(plain.modifier + 1);
	});

	it('damages the target on a hit and never sticks', async () => {
		const card = new StickethCard();
		sinon.stub(card, 'getAttackRoll').returns(fakeRoll(19, 0));
		sinon.stub(card, 'getDamageRoll').returns({ ...fakeRoll(6, 1, 10) } as any);
		const hitSpy = sinon.spy(foe, 'hit');
		const saveSpy = sinon.spy(card, 'stickSave');

		await card.play(unicorn, foe, ring, contestants);

		expect(hitSpy).to.have.been.calledOnce;
		expect(hitSpy.firstCall.args[0]).to.equal(7);
		expect(saveSpy).not.to.have.been.called;
		expect(isStuck(unicorn)).to.equal(false);
	});

	it('deals max damage on a natural 20 with no extra multiplier', async () => {
		const card = new StickethCard();
		sinon.stub(card, 'getAttackRoll').returns(fakeRoll(20, 0));
		const hitSpy = sinon.spy(foe, 'hit');

		await card.play(unicorn, foe, ring, contestants);

		expect(hitSpy.firstCall.args[0]).to.equal(10 + unicorn.strModifier);
	});

	it('pulls up after a miss when the STR save beats the target\'s dex', async () => {
		const card = new StickethCard();
		sinon.stub(card, 'getAttackRoll').returns(fakeRoll(2, 0));
		sinon.stub(card, 'getStickSaveRoll').returns(fakeRoll(foe.dex + 1, 0));

		await card.play(unicorn, foe, ring, contestants);

		expect(isStuck(unicorn)).to.equal(false);
		expect(isStuck(foe)).to.equal(false);
	});

	it('sticks only the Unicorn who played it when the save fails', async () => {
		const card = new StickethCard();
		sinon.stub(card, 'getAttackRoll').returns(fakeRoll(2, 0));
		sinon.stub(card, 'getStickSaveRoll').returns(fakeRoll(2, 0));
		const unicornHit = sinon.spy(unicorn, 'hit');
		const foeHit = sinon.spy(foe, 'hit');

		await card.play(unicorn, foe, ring, contestants);

		expect(isStuck(unicorn)).to.equal(true);
		expect(isStuck(foe)).to.equal(false);
		expect(unicorn.encounterModifiers.immobilizedTurns).to.equal(0);
		// Counterplay, not self-damage.
		expect(unicornHit).not.to.have.been.called;
		expect(foeHit).not.to.have.been.called;
	});

	it('fails the save automatically on a natural 1, whatever the modifier', async () => {
		const card = new StickethCard();
		sinon.stub(card, 'getAttackRoll').returns(fakeRoll(2, 0));
		sinon.stub(card, 'getStickSaveRoll').returns(fakeRoll(1, 99));

		await card.play(unicorn, foe, ring, contestants);

		expect(isStuck(unicorn)).to.equal(true);
	});

	it('treats a natural 1 on the charge as a miss, not a self-inflicted hit', async () => {
		const card = new StickethCard();
		sinon.stub(card, 'getAttackRoll').returns(fakeRoll(1, 0));
		sinon.stub(card, 'getStickSaveRoll').returns(fakeRoll(20, 0));
		const unicornHit = sinon.spy(unicorn, 'hit');
		const misses: any[] = [];
		card.on('miss', (_className: string, _card: any, payload: any) => misses.push(payload));

		await card.play(unicorn, foe, ring, contestants);

		expect(unicornHit).not.to.have.been.called;
		expect(misses).to.have.length(1);
		expect(misses[0].curseOfLoki).to.equal(true);
	});

	it('costs the stuck Unicorn their next card until they pull free', async () => {
		const card = new StickethCard();
		sinon.stub(card, 'getAttackRoll').returns(fakeRoll(2, 0));
		sinon.stub(card, 'getStickSaveRoll').returns(fakeRoll(2, 0));
		await card.play(unicorn, foe, ring, contestants);
		sinon.restore();

		// The next turn's freedom roll fails: the card does nothing and the Unicorn stays stuck.
		const [stuckEffect] = unicorn.encounterEffects;
		const nextCard = new HitCard();
		const foeHit = sinon.spy(foe, 'hit');
		const freedomStub = sinon.stub(StickethCard.prototype, 'getFreedomRoll').returns(fakeRoll(2, 0));

		await nextCard.play(unicorn, foe, ring, contestants);

		expect(foeHit).not.to.have.been.called;
		expect(unicorn.encounterModifiers.immobilizedTurns).to.equal(1);
		expect(unicorn.encounterEffects).to.include(stuckEffect);

		// The turn after, a natural 20 frees them and the card plays normally.
		freedomStub.returns(fakeRoll(20, 0));
		sinon.stub(HitCard.prototype, 'getAttackRoll').returns(fakeRoll(19, 0));

		await nextCard.play(unicorn, foe, ring, contestants);

		expect(isStuck(unicorn)).to.equal(false);
		expect(foeHit).to.have.been.calledOnce;
		// Breaking free of your own horn never deals the "hits immobilizer back" damage.
		expect(unicorn.hp).to.equal(unicorn.maxHp);
	});

	it('narrates the stuck turn without calling the Unicorn their own captor', async () => {
		const card = new StickethCard();
		sinon.stub(card, 'getAttackRoll').returns(fakeRoll(2, 0));
		sinon.stub(card, 'getStickSaveRoll').returns(fakeRoll(2, 0));
		const narrations: string[] = [];
		const effects: any[] = [];
		card.on('narration', (_c: string, _card: any, { narration }: any) => narrations.push(narration));
		card.on('effect', (_c: string, _card: any, payload: any) => effects.push(payload));

		await card.play(unicorn, foe, ring, contestants);
		sinon.stub(StickethCard.prototype, 'getFreedomRoll').returns(fakeRoll(2, 0));
		await new HitCard().play(unicorn, foe, ring, contestants);

		expect(effects).to.have.length(0);
		expect(narrations.join('\n')).to.include('Nola\'s horn 🦄 sticks fast in the timber');
		expect(narrations.join('\n')).to.include('their own str');
		expect(narrations.join('\n')).to.include('Bram has an opening.');
		expect(narrations.join('\n')).to.include('Nola\'s horn is still 🦄 stuck fast in the timber.');
	});

	it('charges against their own AC and can stick when confused into targeting themself', async () => {
		const card = new StickethCard();
		sinon.stub(card, 'getAttackRoll').returns(fakeRoll(2, 0));
		sinon.stub(card, 'getStickSaveRoll').returns(fakeRoll(2, 0));
		const rolled: any[] = [];
		card.on('rolled', (_c: string, _card: any, payload: any) => rolled.push(payload));

		await card.effect(unicorn, unicorn, ring, contestants);

		expect(rolled[0].reason).to.include('own ac');
		expect(rolled[1].reason).to.include('own dex');
		expect(isStuck(unicorn)).to.equal(true);
	});

	it('clears the stuck state when the encounter ends', async () => {
		const card = new StickethCard();
		sinon.stub(card, 'getAttackRoll').returns(fakeRoll(2, 0));
		sinon.stub(card, 'getStickSaveRoll').returns(fakeRoll(2, 0));
		await card.play(unicorn, foe, ring, contestants);
		expect(isStuck(unicorn)).to.equal(true);

		unicorn.endEncounter();

		expect(isStuck(unicorn)).to.equal(false);
		expect(unicorn.encounterModifiers.immobilizedTurns).to.equal(undefined);
	});

	it('does not stick a Unicorn who is already held', async () => {
		const card = new StickethCard();
		const hold = Object.assign(() => undefined, { effectType: 'ImmobilizeEffect' });
		unicorn.encounterEffects = [hold];

		card.stickFast(unicorn, ring);

		expect(unicorn.encounterEffects).to.deep.equal([hold]);
	});

	it('hydrates from JSON and ships in the starting deck', () => {
		const card = new StickethCard();
		const restored = hydrateCard(JSON.parse(JSON.stringify(card)));

		expect(restored).to.be.instanceOf(StickethCard);
		expect(restored.stats).to.equal(card.stats);
		expect(getMinimumDeck().some((c: any) => c instanceof StickethCard)).to.equal(true);
	});
});
