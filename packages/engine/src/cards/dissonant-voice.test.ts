import { expect } from 'chai';
import sinon from 'sinon';

import { DissonantVoiceCard } from './dissonant-voice.js';
import { HitCard } from './hit.js';
import { HealCard } from './heal.js';
import { hydrateCard } from './helpers/hydrate.js';
import Unicorn from '../monsters/unicorn.js';
import Gladiator from '../monsters/gladiator.js';
import Minotaur from '../monsters/minotaur.js';
import Jinn from '../monsters/jinn.js';
import { DISSONANT_VOICE_EFFECT } from '../constants/effect-types.js';
import { BARD } from '../constants/creature-classes.js';
import { UNICORN } from '../constants/creature-types.js';

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

const isRattled = (monster: any) =>
	monster.encounterEffects.some((effect: any) => effect.effectType === DISSONANT_VOICE_EFFECT);

describe('./cards/dissonant-voice.ts Dissonant Voice', () => {
	let unicorn: any;
	let foe: any;
	let other: any;
	let ring: any;
	let contestants: any[];

	beforeEach(() => {
		unicorn = new Unicorn({ name: 'Nola', xp: 50 });
		foe = new Gladiator({ name: 'Tor' });
		other = new Minotaur({ name: 'Bram' });
		contestants = [unicorn, foe, other].map(monster => ({ monster, character: {} }));
		ring = {
			contestants,
			encounterEffects: [],
			channelManager: { sendMessages: () => Promise.resolve() },
		};
		for (const { monster } of contestants) monster.startEncounter(ring);
	});

	afterEach(() => sinon.restore());

	it('is a level 1 Unicorn or Bard card', () => {
		expect(DissonantVoiceCard.permittedClassesAndTypes).to.deep.equal([UNICORN, BARD]);
		expect(DissonantVoiceCard.level).to.equal(1);
		expect(new Jinn({ xp: 50 }).canHoldCard(DissonantVoiceCard)).to.equal(true);
		expect(new DissonantVoiceCard().stats).to.include('No damage');
	});

	it('targets every opponent and never the player', () => {
		const targets = new DissonantVoiceCard().getTargets(unicorn, foe, ring, contestants);
		expect(targets).to.deep.equal([foe, other]);
	});

	it('leaves allies alone in a team fight', () => {
		(contestants[0] as any).team = 'north';
		(contestants[1] as any).team = 'north';
		(contestants[2] as any).team = 'south';

		const targets = new DissonantVoiceCard().getTargets(unicorn, foe, ring, contestants);

		expect(targets).to.deep.equal([other]);
	});

	it('rattles each opponent who fails the save, one save at a time, with no damage', async () => {
		const card = new DissonantVoiceCard();
		const save = sinon.stub(card, 'getSaveRoll');
		save.onFirstCall().returns(fakeRoll(2));
		save.onSecondCall().returns(fakeRoll(20));
		const rolled: any[] = [];
		card.on('rolled', (_c: string, _card: any, payload: any) => rolled.push(payload));
		const foeHit = sinon.spy(foe, 'hit');

		await card.play(unicorn, foe, ring, contestants);

		expect(rolled.map(({ who }) => who)).to.deep.equal([foe, other]);
		expect(isRattled(foe)).to.equal(true);
		expect(isRattled(other)).to.equal(false);
		expect(foeHit).not.to.have.been.called;
	});

	describe('with the disadvantage setting on', () => {
		beforeEach(() => {
			DissonantVoiceCard.disadvantage = true;
		});
		afterEach(() => {
			DissonantVoiceCard.disadvantage = false;
		});

		it('rattles every opponent with no save and no damage', async () => {
			const card = new DissonantVoiceCard();
			const save = sinon.spy(card, 'getSaveRoll');
			const foeHit = sinon.spy(foe, 'hit');

			await card.play(unicorn, foe, ring, contestants);

			expect(save).not.to.have.been.called;
			expect(isRattled(foe)).to.equal(true);
			expect(isRattled(other)).to.equal(true);
			expect(isRattled(unicorn)).to.equal(false);
			expect(foeHit).not.to.have.been.called;
			expect(card.stats).to.include('keeps the worse roll');
		});

		it('rolls the next attack twice and keeps the worse, then is spent', async () => {
			await new DissonantVoiceCard().effect(unicorn, foe, ring);
			const rolls = [fakeRoll(15), fakeRoll(6), fakeRoll(20), fakeRoll(3)];
			const stub = sinon.stub(HitCard.prototype, 'getAttackRoll').callsFake(() => rolls.shift() as any);
			const hitCheck = sinon.spy(HitCard.prototype, 'hitCheck');

			await new HitCard().play(foe, unicorn, ring, contestants);
			expect(hitCheck.firstCall.returnValue.attackRoll.result).to.equal(6);
			expect(isRattled(foe)).to.equal(false);

			await new HitCard().play(foe, unicorn, ring, contestants);
			expect(hitCheck.secondCall.returnValue.attackRoll.result).to.equal(20);
			expect(stub.callCount).to.equal(3);
		});

		it('treats a natural 20 as the best roll and a 1 as the worst', async () => {
			await new DissonantVoiceCard().effect(unicorn, foe, ring);
			const rolls = [fakeRoll(20, -5), fakeRoll(18)];
			sinon.stub(HitCard.prototype, 'getAttackRoll').callsFake(() => rolls.shift() as any);
			const hitCheck = sinon.spy(HitCard.prototype, 'hitCheck');

			await new HitCard().play(foe, unicorn, ring, contestants);

			expect(hitCheck.firstCall.returnValue.attackRoll.strokeOfLuck).to.equal(false);
		});
	});

	it('takes 2 off the rattled monster\'s next attack roll only', async () => {
		const card = new DissonantVoiceCard();
		sinon.stub(card, 'getSaveRoll').returns(fakeRoll(2));
		await card.effect(unicorn, foe, ring);

		const attackRolls: any[] = [];
		const original = HitCard.prototype.getAttackRoll;
		sinon.stub(HitCard.prototype, 'getAttackRoll').callsFake(function (this: any, ...args: any[]) {
			const attackRoll = original.apply(this, args as any);
			attackRolls.push(attackRoll);
			return attackRoll;
		});
		sinon.stub(Math, 'random').returns(0.5);

		await new HitCard().play(foe, unicorn, ring, contestants);
		await new HitCard().play(foe, unicorn, ring, contestants);

		expect(attackRolls[0].modifier).to.equal(attackRolls[1].modifier - 2);
		expect(attackRolls[0].result).to.equal(attackRolls[1].result - 2);
		expect(isRattled(foe)).to.equal(false);
	});

	it('is spent by a non-attack card as well', async () => {
		const card = new DissonantVoiceCard();
		sinon.stub(card, 'getSaveRoll').returns(fakeRoll(2));
		await card.effect(unicorn, foe, ring);

		await new HealCard().play(foe, foe, ring, contestants);

		expect(isRattled(foe)).to.equal(false);
	});

	it('does not stack', async () => {
		const card = new DissonantVoiceCard();
		sinon.stub(card, 'getSaveRoll').returns(fakeRoll(2));

		await card.effect(unicorn, foe, ring);
		await card.effect(unicorn, foe, ring);

		expect(foe.encounterEffects.filter((e: any) => e.effectType === DISSONANT_VOICE_EFFECT)).to.have.length(1);
	});

	it('rattles whoever confusion points it at, including the singer', async () => {
		const card = new DissonantVoiceCard();
		sinon.stub(card, 'getSaveRoll').returns(fakeRoll(2));
		const rolled: any[] = [];
		card.on('rolled', (_c: string, _card: any, payload: any) => rolled.push(payload));

		await card.effect(unicorn, unicorn, ring);

		expect(isRattled(unicorn)).to.equal(true);
		expect(rolled[0].reason).to.include('own int');
	});

	it('is gone after the encounter ends', async () => {
		const card = new DissonantVoiceCard();
		sinon.stub(card, 'getSaveRoll').returns(fakeRoll(2));
		await card.effect(unicorn, foe, ring);

		foe.endEncounter();

		expect(isRattled(foe)).to.equal(false);
	});

	it('hydrates from JSON', () => {
		const restored = hydrateCard(JSON.parse(JSON.stringify(new DissonantVoiceCard())));
		expect(restored).to.be.instanceOf(DissonantVoiceCard);
	});
});
