import { expect } from 'chai';
import sinon from 'sinon';

import { WhiskeyShotCard, isTipsy, TIPSY_CARDS, TIPSY_TABLE } from './whiskey-shot.js';
import { ScotchCard } from './scotch.js';
import { HitCard } from './hit.js';
import { HealCard } from './heal.js';
import Minotaur from '../monsters/minotaur.js';
import Basilisk from '../monsters/basilisk.js';

/* Tipsy (owner, 2026-10-12): the third drink in one round rolls 1d20 + str vs 10 to hold it. */
describe('Tipsy (cards/whiskey-shot.ts)', () => {
	let drinker: any;
	let foe: any;
	let ring: any;
	let contestants: any[];
	let narrations: string[];

	const strength = (bonus: number) =>
		Object.defineProperty(drinker, 'strModifier', { get: () => bonus, configurable: true });

	beforeEach(() => {
		drinker = new Minotaur({ name: 'Bram', gender: 'male' });
		foe = new Basilisk({ name: 'Sly', gender: 'female' });
		contestants = [drinker, foe].map(monster => ({ monster, character: {} }));
		ring = { contestants, encounterEffects: [], channelManager: { sendMessages: () => Promise.resolve() } };
		drinker.startEncounter(ring);
		foe.startEncounter(ring);
		drinker.round = 1;
		narrations = [];
		strength(-100);
		// Heal's 1% poison and 1% half-max-hp rolls would make a drink a coin toss; a plain
		// 1 hp sip keeps these tests about the drink count.
		sinon.stub(HealCard.prototype, 'checkSuccess').returns({
			curseOfLoki: false,
			healRoll: { result: 1 },
			result: 1,
			strokeOfLuck: false,
			success: true,
		} as any);
		// Face 6, properly drunk (-2 dex, -2 int), unless a test picks another.
		sinon.stub(WhiskeyShotCard.prototype, 'rollTipsyKind').returns(TIPSY_TABLE[5]);
	});

	afterEach(() => sinon.restore());

	const drink = (Card: typeof WhiskeyShotCard = WhiskeyShotCard) => {
		const card = new Card();
		card.on('narration', (_c: string, _card: any, { narration }: any) => narrations.push(narration));
		return card.play(drinker, drinker, ring, contestants);
	};

	it('needs three drinks in one round, Scotch included', async () => {
		await drink();
		await drink(ScotchCard);
		expect(isTipsy(drinker)).to.equal(false);

		await drink();
		expect(isTipsy(drinker)).to.equal(true);
		expect(narrations).to.include('🥃 Bram is tipsy, properly drunk! (-2 dex and -2 int for his next 2 cards.)');
	});

	it('starts counting again in a new round', async () => {
		await drink();
		await drink();
		drinker.round = 2;
		await drink();
		expect(isTipsy(drinker)).to.equal(false);
	});

	it('lets a strong drinker hold it', async () => {
		strength(100);
		await drink();
		await drink();
		await drink();
		expect(isTipsy(drinker)).to.equal(false);
	});

	it('costs what the 1d6 rolled for two cards, then sobers up before the third', async () => {
		const dex = drinker.dexModifier;
		const int = drinker.intModifier;
		await drink();
		await drink();
		await drink();
		expect(drinker.dexModifier).to.equal(dex - 2);
		expect(drinker.intModifier).to.equal(int - 2);

		const hit = () => {
			const card = new HitCard();
			(card as any).effect = async () => true;
			return card.play(drinker, foe, ring, contestants);
		};
		for (let i = 0; i < TIPSY_CARDS; i += 1) {
			await hit();
			expect(isTipsy(drinker), `card ${i + 1}`).to.equal(true);
		}
		await hit();
		expect(isTipsy(drinker)).to.equal(false);
		expect(drinker.dexModifier).to.equal(dex);
		expect(drinker.intModifier).to.equal(int);
	});

	it('restarts the clock on a drink while tipsy, even one it holds (PR #432 review)', async () => {
		await drink();
		await drink();
		await drink();
		const tipsy = drinker.encounterEffects.find((e: any) => e.effectType === 'Tipsy Effect');
		// One card left: this drink's own turn start counts it down to 0, so without the fix
		// the very next card would sober up despite the fresh drink.
		tipsy.cardsLeft = 1;
		strength(100);

		await drink();

		expect(tipsy.cardsLeft).to.equal(TIPSY_CARDS);
	});

	it('restarts the clock on another drink rather than stacking', async () => {
		const dex = drinker.dexModifier;
		await drink();
		await drink();
		await drink();
		await drink();
		expect(drinker.dexModifier).to.equal(dex - 2);
		expect(narrations).to.include('🥃 Bram is still tipsy, and now for 2 more cards.');
	});

	// Owner, 2026-10-14: 1 -1 int, 2 -2 int, 3 -1 dex, 4 -2 dex, 5 the Ballmer peak, 6 -2/-2.
	it('rolls 1d6 for what kind of tipsy, and sobering up undoes exactly that', async () => {
		expect(TIPSY_TABLE.map(({ dex, int }) => [dex, int])).to.deep.equal([
			[0, -1], [0, -2], [-1, 0], [-2, 0], [1, 1], [-2, -2],
		]);
		(WhiskeyShotCard.prototype.rollTipsyKind as sinon.SinonStub).returns(TIPSY_TABLE[4]);
		const dex = drinker.dexModifier;
		const int = drinker.intModifier;
		await drink();
		await drink();
		await drink();
		expect(drinker.dexModifier).to.equal(dex + 1);
		expect(drinker.intModifier).to.equal(int + 1);
		expect(narrations).to.include('🥃 Bram is tipsy, at the Ballmer peak, sharper for it! (+1 dex and +1 int for his next 2 cards.)');

		const hit = () => {
			const card = new HitCard();
			(card as any).effect = async () => true;
			return card.play(drinker, foe, ring, contestants);
		};
		for (let i = 0; i <= TIPSY_CARDS; i += 1) await hit();
		expect(isTipsy(drinker)).to.equal(false);
		expect(drinker.dexModifier).to.equal(dex);
		expect(drinker.intModifier).to.equal(int);
	});

	it('rolls a real d6 on the table, never a crit', () => {
		sinon.restore();
		const card = new WhiskeyShotCard();
		const rolls: any[] = [];
		card.on('rolled', (_c: unknown, _card: unknown, payload: any) => rolls.push(payload.roll));
		for (let i = 0; i < 60; i += 1) expect(TIPSY_TABLE).to.include(card.rollTipsyKind(drinker));
		expect(rolls.every(r => r.primaryDice === '1d6' && !r.curseOfLoki && !r.strokeOfLuck)).to.equal(true);
	});
});
