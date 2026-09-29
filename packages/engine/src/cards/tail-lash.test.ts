import { expect } from 'chai';
import sinon from 'sinon';

import { TailLashCard } from './tail-lash.js';
import { hydrateCard } from './helpers/hydrate.js';
import Dragon from '../monsters/dragon.js';
import Gladiator from '../monsters/gladiator.js';
import Minotaur from '../monsters/minotaur.js';
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

describe('./cards/tail-lash.ts Tail Lash', () => {
	let dragon: any;
	let foe: any;
	let ring: any;
	let contestants: any[];

	beforeEach(() => {
		dragon = new Dragon({ name: 'Ember', xp: 50 });
		foe = new Gladiator({ name: 'Tor', xp: 50 });
		contestants = [dragon, foe].map(monster => ({ monster, character: {} }));
		ring = {
			contestants,
			encounterEffects: [],
			channelManager: { sendMessages: () => Promise.resolve() },
		};
		for (const { monster } of contestants) monster.startEncounter(ring);
	});

	afterEach(() => sinon.restore());

	it('is a level 1 uncommon Dragon card, hydratable, and not for a Minotaur', () => {
		expect(TailLashCard.permittedClassesAndTypes).to.deep.equal([DRAGON]);
		expect(TailLashCard.level).to.equal(1);
		expect(dragon.canHoldCard(TailLashCard)).to.equal(true);
		expect(new Minotaur({ xp: 50 }).canHoldCard(TailLashCard)).to.equal(false);
		expect(new TailLashCard().stats).to.include('1d4 damage');
		const restored = hydrateCard(JSON.parse(JSON.stringify(new TailLashCard())));
		expect(restored).to.be.instanceOf(TailLashCard);
	});

	it('lashes with the tail after a landed hit on a living target', async () => {
		const card = new TailLashCard();
		sinon.stub(card, 'getAttackRoll').returns(fakeRoll(15));
		const hit = sinon.stub(foe, 'hit').resolves(true);
		// Tail roll: natural 20 would be a crit, so aim for a plain high roll.
		sinon.stub(Math, 'random').returns(0.9);
		const rolled: any[] = [];
		card.on('rolled', (_c: string, _card: any, payload: any) => rolled.push(payload));

		await card.effect(dragon, foe, ring, contestants);

		expect(hit.callCount).to.equal(2);
		expect(hit.secondCall.args[1]).to.equal(dragon);
		const tailRoll = rolled.find(({ who }) => who?.givenName === "Ember's tail");
		expect(tailRoll).to.exist;
		expect(tailRoll.roll.modifier).to.equal(dragon.strModifier - TailLashCard.tailHitPenalty);
		expect(tailRoll.roll.primaryDice).to.equal('1d20');
	});

	it('does not lash after a miss', async () => {
		const card = new TailLashCard();
		sinon.stub(card, 'getAttackRoll').returns(fakeRoll(2));
		const hit = sinon.stub(foe, 'hit').resolves(true);
		const rolled: any[] = [];
		card.on('rolled', (_c: string, _card: any, payload: any) => rolled.push(payload));

		await card.effect(dragon, foe, ring, contestants);

		expect(hit).not.to.have.been.called;
		expect(rolled.some(({ who }) => who?.givenName === "Ember's tail")).to.equal(false);
	});

	it('does not lash when the hit killed the target', async () => {
		const card = new TailLashCard();
		sinon.stub(card, 'getAttackRoll').returns(fakeRoll(15));
		const hit = sinon.stub(foe, 'hit').callsFake(async () => {
			foe.dead = true;
			return false;
		});

		await card.effect(dragon, foe, ring, contestants);

		expect(hit.callCount).to.equal(1);
	});

	it('does not lash at itself in confusion', async () => {
		const card = new TailLashCard();
		sinon.stub(card, 'getAttackRoll').returns(fakeRoll(20, 10));
		const hit = sinon.stub(dragon, 'hit').resolves(true);

		await card.effect(dragon, dragon, ring, contestants);

		expect(hit.callCount).to.equal(1);
	});

	it('uses the class-setting profile and never crits', async () => {
		const original = { dice: TailLashCard.tailDamageDice, penalty: TailLashCard.tailHitPenalty };
		TailLashCard.tailDamageDice = '1d6';
		TailLashCard.tailHitPenalty = 5;
		try {
			const card = new TailLashCard();
			sinon.stub(card, 'getAttackRoll').returns(fakeRoll(15));
			sinon.stub(foe, 'hit').resolves(true);
			sinon.stub(Math, 'random').returns(0.999);
			const rolled: any[] = [];
			card.on('rolled', (_c: string, _card: any, payload: any) => rolled.push(payload));

			await card.effect(dragon, foe, ring, contestants);

			const tailRoll = rolled.find(({ who }) => who?.givenName === "Ember's tail");
			expect(tailRoll.roll.modifier).to.equal(dragon.strModifier - 5);
			expect(tailRoll.roll.strokeOfLuck).to.not.equal(true);
			expect(card.stats).to.include('1d6 damage');
			const tailDamage = rolled.filter(({ reason }) => reason === 'for damage.').pop();
			expect(tailDamage.who.givenName).to.equal("Ember's tail");
			expect(tailDamage.roll.primaryDice).to.equal('1d6');
		} finally {
			TailLashCard.tailDamageDice = original.dice;
			TailLashCard.tailHitPenalty = original.penalty;
		}
	});
});
