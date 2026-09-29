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

	const settings = { holdFatigue: HelmOfAweCard.holdFatigue, fleeOnLoki: HelmOfAweCard.fleeOnLoki };

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

	afterEach(() => {
		sinon.restore();
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

	// Plays a Hit for `foe` and says whether it actually acted.
	const foeActs = async () => {
		const effect = sinon.spy(HitCard.prototype, 'effect');
		await new HitCard().play(foe, dragon, ring, contestants);
		const acted = effect.called;
		effect.restore();
		return acted;
	};

	it('ships as the pin with the healthy flee, and says so', () => {
		expect(settings).to.deep.equal({ holdFatigue: 3, fleeOnLoki: 'healthy' });
		const { stats } = new HelmOfAweCard();
		expect(stats).to.include('they are awed and lose their next card');
		expect(stats).to.include('3 easier each time');
		expect(stats).to.include('not bloodied tries to flee');
		expect(stats).to.include('No damage');
	});

	it('is a level 2 rare Dragon card, hydratable, and not for a Minotaur', () => {
		expect(HelmOfAweCard.permittedClassesAndTypes).to.deep.equal([DRAGON]);
		expect(HelmOfAweCard.level).to.equal(2);
		expect(HelmOfAweCard.notForSale).to.equal(true);
		expect(dragon.canHoldCard(HelmOfAweCard)).to.equal(true);
		expect(other.canHoldCard(HelmOfAweCard)).to.equal(false);
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

	it('does nothing on a successful save', async () => {
		await aweWith([20]);
		expect(isAwed(foe)).to.equal(false);
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

	it('loses a card that does not roll to hit, too', async () => {
		await aweWith([2]);
		const heal = sinon.spy(HealCard.prototype, 'effect');
		await new HealCard().play(foe, foe, ring, contestants);
		expect(heal).not.to.have.been.called;
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

	it('on a natural 1, a healthy monster runs from the ring on a good flee roll', async () => {
		const { card } = await aweWith([2, 1]);
		sinon.stub(card, 'getFleeRoll').returns(fakeRoll(15));
		await foeActs();
		await new HitCard().play(foe, dragon, ring, contestants);
		expect(foe.fled).to.equal(true);
		expect(isAwed(foe)).to.equal(false);
	});

	it('on a natural 1, a healthy monster that fails its flee roll cowers', async () => {
		const { card } = await aweWith([2, 1]);
		sinon.stub(card, 'getFleeRoll').returns(fakeRoll(3));
		await foeActs();
		expect(await foeActs()).to.equal(false);
		expect(foe.fled).to.equal(false);
		expect(isAwed(foe)).to.equal(true);
	});

	it('on a natural 1, a bloodied monster cowers without trying to flee', async () => {
		const { card } = await aweWith([2, 1]);
		const flee = sinon.stub(card, 'getFleeRoll').returns(fakeRoll(15));
		foe.hp = 1;
		await foeActs();
		expect(await foeActs()).to.equal(false);
		expect(flee).not.to.have.been.called;
		expect(foe.fled).to.equal(false);
	});

	it('frightens a boss away like anyone else', async () => {
		foe.setOptions({ isBoss: true });
		const { card } = await aweWith([2, 1]);
		sinon.stub(card, 'getFleeRoll').returns(fakeRoll(15));
		await foeActs();
		await new HitCard().play(foe, dragon, ring, contestants);
		expect(foe.fled).to.equal(true);
	});

	it('with fleeOnLoki none (harness), a natural 1 only cowers', async () => {
		HelmOfAweCard.fleeOnLoki = 'none';
		expect(new HelmOfAweCard().stats).not.to.include('flee');
		await aweWith([2, 1]);
		await foeActs();
		expect(await foeActs()).to.equal(false);
		expect(foe.fled).to.equal(false);
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
		await aweWith([2]);
		foe.endEncounter();
		expect(isAwed(foe)).to.equal(false);
	});
});
