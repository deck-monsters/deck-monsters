import { expect } from 'chai';
import sinon from 'sinon';

import { AsinineCompanionCard } from './asinine-companion.js';
import { BoostCard } from './boost.js';
import { hydrateCard } from './helpers/hydrate.js';
import Dragon from '../monsters/dragon.js';
import Gladiator from '../monsters/gladiator.js';
import Minotaur from '../monsters/minotaur.js';
import { DRAGON } from '../constants/creature-types.js';
import { BOOST, MELEE } from '../constants/card-classes.js';
import { isAttackCard } from './helpers/ancient-dragon.js';

describe('./cards/asinine-companion.ts Asinine Companion', () => {
	it('is a level 1 Dragon boost card, hydratable, and not for a Minotaur', () => {
		expect(AsinineCompanionCard.permittedClassesAndTypes).to.deep.equal([DRAGON]);
		expect(AsinineCompanionCard.level).to.equal(1);
		expect(new AsinineCompanionCard()).to.be.instanceOf(BoostCard);
		expect(new Dragon({ xp: 50 }).canHoldCard(AsinineCompanionCard)).to.equal(true);
		expect(new Minotaur({ xp: 50 }).canHoldCard(AsinineCompanionCard)).to.equal(false);
		const restored = hydrateCard(JSON.parse(JSON.stringify(new AsinineCompanionCard())));
		expect(restored).to.be.instanceOf(AsinineCompanionCard);
	});

	// The shipped shape is the scaled 1d8 kick (roadmap 35); the boost shape is still selectable.
	const shipped = {
		kick: AsinineCompanionCard.kick,
		kickScales: AsinineCompanionCard.kickScales,
		kickDamageDice: AsinineCompanionCard.kickDamageDice,
		kickHitBonus: AsinineCompanionCard.kickHitBonus,
	};
	afterEach(() => {
		Object.assign(AsinineCompanionCard, shipped);
	});

	it('ships the donkey kick, 1d8, growing with the dragon', () => {
		expect(shipped).to.deep.equal({ kick: true, kickScales: true, kickDamageDice: '1d8', kickHitBonus: 2 });
		expect(new AsinineCompanionCard().stats).to.include('+ your level (up to 10)');
	});

	it('is a melee attack while kicking, so braces and outwitting apply, and a boost otherwise', () => {
		const kicking = new AsinineCompanionCard();
		expect(kicking.isCardClass(MELEE)).to.equal(true);
		expect(kicking.isCardClass(BOOST)).to.equal(false);
		expect(isAttackCard(kicking)).to.equal(true);
		AsinineCompanionCard.kick = false;
		const boosting = new AsinineCompanionCard();
		expect(boosting.isCardClass(BOOST)).to.equal(true);
		expect(isAttackCard(boosting)).to.equal(false);
	});

	it('boosts STR by 2 in the boost shape', () => {
		AsinineCompanionCard.kick = false;
		const card = new AsinineCompanionCard();
		expect(card.boostedProp).to.equal('str');
		expect(card.boostAmount).to.equal(2);
		expect(card.stats).to.include('str +2');
	});
	describe('with the kick setting on', () => {
		let dragon: any;
		let foe: any;
		let ring: any;
		let contestants: any[];

		beforeEach(() => {
			AsinineCompanionCard.kick = true;
			AsinineCompanionCard.kickScales = false;
			AsinineCompanionCard.kickDamageDice = '1d6';
			dragon = new Dragon({ name: 'Ember', xp: 300 });
			foe = new Gladiator({ name: 'Tor' });
			contestants = [dragon, foe].map(monster => ({ monster, character: {} }));
			ring = { contestants, encounterEffects: [], channelManager: { sendMessages: () => Promise.resolve() } };
			for (const { monster } of contestants) monster.startEncounter(ring);
		});
		afterEach(() => {
			sinon.restore();
		});

		it('targets the proposed opponent, not the dragon', () => {
			const card = new AsinineCompanionCard();
			expect(card.getTargets(dragon, foe, ring, contestants)).to.deep.equal([foe]);
			expect(card.stats).to.include('kicks');
		});

		it('kicks with the class-setting profile, credited to the dragon, with no STR boost', async () => {
			AsinineCompanionCard.kickHitBonus = 30;
			AsinineCompanionCard.kickDamageDice = '1d1';
			const card = new AsinineCompanionCard();
			const rolls: any[] = [];
			card.on('rolled', (_c: string, _card: any, payload: any) => rolls.push(payload));
			const hit = sinon.spy(foe, 'hit');
			const setModifier = sinon.spy(dragon, 'setModifier');

			await card.play(dragon, foe, ring, contestants);

			expect(rolls[0].roll.primaryDice).to.equal('1d20');
			expect(rolls[0].roll.modifier).to.equal(30);
			expect(hit).to.have.been.calledOnce;
			expect(hit.firstCall.args[0]).to.equal(1);
			expect(hit.firstCall.args[1]).to.equal(dragon);
			expect(setModifier).not.to.have.been.called;
		});

		it('never crits: a natural 20 is only a normal hit and a natural 1 can still hit', async () => {
			AsinineCompanionCard.kickHitBonus = 30;
			const card = new AsinineCompanionCard();
			const rolls: any[] = [];
			card.on('rolled', (_c: string, _card: any, payload: any) => rolls.push(payload));
			await card.effect(dragon, foe, ring);
			expect(rolls[0].roll.strokeOfLuck).not.to.equal(true);
			expect(rolls[0].roll.curseOfLoki).not.to.equal(true);
		});
	});
});
