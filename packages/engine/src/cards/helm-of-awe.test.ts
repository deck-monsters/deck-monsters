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

	afterEach(() => sinon.restore());

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
});
