import { expect } from 'chai';
import sinon from 'sinon';

import { GloamingRestCard } from './gloaming-rest.js';
import { HealCard } from './heal.js';
import { HitCard } from './hit.js';
import { hydrateCard } from './helpers/hydrate.js';
import Unicorn from '../monsters/unicorn.js';
import Minotaur from '../monsters/minotaur.js';
import WeepingAngel from '../monsters/weeping-angel.js';
import { GLOAMING_REST_EFFECT } from '../constants/effect-types.js';
import { CLERIC } from '../constants/creature-classes.js';
import { UNICORN } from '../constants/creature-types.js';

const isResting = (monster: any) =>
	monster.encounterEffects.some((effect: any) => effect.effectType === GLOAMING_REST_EFFECT);

describe('./cards/gloaming-rest.ts Gloaming Rest', () => {
	let unicorn: any;
	let foe: any;
	let ring: any;
	let contestants: any[];

	beforeEach(() => {
		unicorn = new Unicorn({ name: 'Nola', gender: 'androgynous', xp: 500 });
		foe = new Minotaur({ name: 'Bram' });
		contestants = [unicorn, foe].map(monster => ({ monster, character: {} }));
		ring = {
			contestants,
			encounterEffects: [],
			channelManager: { sendMessages: () => Promise.resolve() },
		};
		unicorn.startEncounter(ring);
		foe.startEncounter(ring);
		unicorn.hp = 5;
	});

	afterEach(() => sinon.restore());

	// Plays the Unicorn's next card, which is when the rest resolves.
	const nextTurn = () => {
		const next = new HitCard();
		sinon.stub(next, 'effect').resolves(true);
		return next.play(unicorn, foe, ring, contestants);
	};

	it('is a level 3 Unicorn or Cleric card that targets its player', () => {
		expect(GloamingRestCard.permittedClassesAndTypes).to.deep.equal([UNICORN, CLERIC]);
		expect(GloamingRestCard.level).to.equal(3);
		expect(new WeepingAngel({ xp: 500 }).canHoldCard(GloamingRestCard)).to.equal(true);
		expect(new GloamingRestCard().getTargets(unicorn)).to.deep.equal([unicorn]);
	});

	it('lowers AC by 2 until the next card, then heals if undisturbed', async () => {
		const baseAc = unicorn.ac;

		await new GloamingRestCard().play(unicorn, foe, ring, contestants);

		expect(unicorn.ac).to.equal(baseAc - 2);
		expect(unicorn.hp).to.equal(5);
		expect(isResting(unicorn)).to.equal(true);

		await nextTurn();

		expect(unicorn.ac).to.equal(baseAc);
		expect(unicorn.hp).to.equal(unicorn.maxHp);
		expect(isResting(unicorn)).to.equal(false);
	});

	it('heals a boss to full as well', async () => {
		unicorn.setOptions({ isBoss: true });
		await new GloamingRestCard().play(unicorn, foe, ring, contestants);
		await nextTurn();
		expect(unicorn.hp).to.equal(unicorn.maxHp);
	});

	describe('rest shapes', () => {
		afterEach(() => {
			GloamingRestCard.restShape = 'full';
		});

		it('a broken rest wakes the unicorn in wrath: its next attack rolls with advantage', async () => {
			GloamingRestCard.brokenRestRage = 'advantage-damage';
			try {
				expect(new GloamingRestCard().stats).to.include('wake in wrath');
				await new GloamingRestCard().play(unicorn, foe, ring, contestants);
				await unicorn.hit(1, foe, new HitCard());
				const rolls = [
					{ result: 4, modifier: 0, strokeOfLuck: false, curseOfLoki: false, naturalRoll: { result: 4 } },
					{ result: 17, modifier: 0, strokeOfLuck: false, curseOfLoki: false, naturalRoll: { result: 17 } },
				];
				sinon.stub(HitCard.prototype, 'getAttackRoll').callsFake(() => rolls.shift() as any);
				const hitCheck = sinon.spy(HitCard.prototype, 'hitCheck');
				const damage = sinon.spy(HitCard.prototype, 'rollForDamage');
				await new HitCard().play(unicorn, foe, ring, contestants);
				expect(hitCheck.firstCall.returnValue.attackRoll.result).to.equal(17);
				expect(damage.firstCall.returnValue.modifier).to.equal(unicorn.strModifier + 2);
				expect(isResting(unicorn)).to.equal(false);
			} finally {
				GloamingRestCard.brokenRestRage = 'none';
			}
		});

		it('passes the wrath on to the next card that rolls to hit', async () => {
			GloamingRestCard.brokenRestRage = 'advantage';
			try {
				await new GloamingRestCard().play(unicorn, foe, ring, contestants);
				await unicorn.hit(1, foe, new HitCard());
				await new HealCard().play(unicorn, unicorn, ring, contestants);
				expect(unicorn.encounterEffects).to.have.length(1);
				const stub = sinon.stub(HitCard.prototype, 'getAttackRoll').callsFake(() => ({ result: 10, modifier: 0, strokeOfLuck: false, curseOfLoki: false, naturalRoll: { result: 10 } }) as any);
				await new HitCard().play(unicorn, foe, ring, contestants);
				expect(stub.callCount).to.equal(2);
				expect(unicorn.encounterEffects).to.have.length(0);
			} finally {
				GloamingRestCard.brokenRestRage = 'none';
			}
		});

		it('dice heals 3d4', async () => {
			GloamingRestCard.restShape = 'dice';
			expect(new GloamingRestCard().stats).to.include('heal 3d4');
			await new GloamingRestCard().play(unicorn, foe, ring, contestants);
			await nextTurn();
			expect(unicorn.hp).to.be.within(5 + 3, 5 + 12);
		});

		it('half heals half the missing hp, rounded down', async () => {
			GloamingRestCard.restShape = 'half';
			expect(new GloamingRestCard().stats).to.include('half your missing hp');
			const missing = unicorn.maxHp - 5;
			await new GloamingRestCard().play(unicorn, foe, ring, contestants);
			await nextTurn();
			expect(unicorn.hp).to.equal(5 + Math.floor(missing / 2));
		});

		it('ranged heals between 4 and half max hp, never more than is missing', async () => {
			GloamingRestCard.restShape = 'ranged';
			expect(new GloamingRestCard().stats).to.include('between 4 hp and half your max hp');
			const card = new GloamingRestCard();
			const random = sinon.stub(Math, 'random');
			unicorn.hp = 1;
			random.returns(0);
			expect(card.restHealAmount(unicorn)).to.equal(4);
			random.returns(0.9999);
			expect(card.restHealAmount(unicorn)).to.equal(Math.floor(unicorn.maxHp / 2));
			unicorn.hp = unicorn.maxHp - 2;
			expect(card.restHealAmount(unicorn)).to.equal(2);
			random.returns(0);
			expect(card.restHealAmount(unicorn)).to.equal(2);
			unicorn.hp = unicorn.maxHp;
			expect(card.restHealAmount(unicorn)).to.equal(0);
		});

		it('two-turns sleeps through one card, then heals to full', async () => {
			GloamingRestCard.restShape = 'two-turns';
			const baseAc = unicorn.ac;
			await new GloamingRestCard().play(unicorn, foe, ring, contestants);
			await nextTurn();
			expect(unicorn.hp).to.equal(5);
			expect(unicorn.ac).to.equal(baseAc - 2);
			expect(isResting(unicorn)).to.equal(true);
			await nextTurn();
			expect(unicorn.hp).to.equal(unicorn.maxHp);
			expect(unicorn.ac).to.equal(baseAc);
			expect(isResting(unicorn)).to.equal(false);
		});

		it('two-turns loses everything to a hit in the second turn', async () => {
			GloamingRestCard.restShape = 'two-turns';
			await new GloamingRestCard().play(unicorn, foe, ring, contestants);
			await nextTurn();
			await unicorn.hit(1, foe, new HitCard());
			await nextTurn();
			expect(unicorn.hp).to.equal(4);
			expect(isResting(unicorn)).to.equal(false);
		});

		it('growing heals more each undisturbed card and keeps it when broken', async () => {
			GloamingRestCard.restShape = 'growing';
			unicorn.setOptions({ hpVariance: 0 });
			const baseAc = unicorn.ac;
			unicorn.hp = 1;
			sinon.stub(Math, 'random').returns(0);
			await new GloamingRestCard().play(unicorn, foe, ring, contestants);
			await nextTurn();
			expect(unicorn.hp).to.equal(1 + 3);
			expect(isResting(unicorn)).to.equal(true);
			expect(unicorn.ac).to.equal(baseAc - 2);
			await unicorn.hit(1, foe, new HitCard());
			await nextTurn();
			expect(unicorn.hp).to.equal(3);
			expect(isResting(unicorn)).to.equal(false);
			expect(unicorn.ac).to.equal(baseAc);
		});
	});

	it('loses the heal if anything damages the Unicorn first', async () => {
		const baseAc = unicorn.ac;
		const card = new GloamingRestCard();
		const narrations: string[] = [];
		card.on('narration', (_c: string, _card: any, { narration }: any) => narrations.push(narration));

		await card.play(unicorn, foe, ring, contestants);
		await unicorn.hit(1, foe, new HitCard());
		await nextTurn();

		expect(unicorn.hp).to.equal(4);
		expect(unicorn.ac).to.equal(baseAc);
		expect(narrations.join('\n')).to.include('The hunters were waiting! Nola\'s rest is broken, and they rise without its comfort');
	});

	it('agrees the kneel line with the name, not the pronoun', async () => {
		// "Nola kneel among the laurel" shipped once: `agree()` was run on a name subject.
		const card = new GloamingRestCard();
		const narrations: string[] = [];
		card.on('narration', (_c: string, _card: any, { narration }: any) => narrations.push(narration));

		await card.play(unicorn, foe, ring, contestants);

		expect(narrations[0]).to.include('Nola kneels among the laurel and closes their eyes.');
	});

	it('ignores hits that landed before the rest began', async () => {
		await unicorn.hit(1, foe, new HitCard());
		await new GloamingRestCard().play(unicorn, foe, ring, contestants);
		await nextTurn();

		expect(unicorn.hp).to.be.greaterThan(4);
	});

	it('does not stack a second rest', async () => {
		const card = new GloamingRestCard();
		const baseAc = unicorn.ac;

		await card.effect(unicorn, unicorn, ring);
		await card.effect(unicorn, unicorn, ring);

		expect(unicorn.ac).to.equal(baseAc - 2);
		expect(unicorn.encounterEffects.filter((e: any) => e.effectType === GLOAMING_REST_EFFECT)).to.have.length(1);
	});

	it('gives the full penalty back, keeping a brace that was up before the rest', async () => {
		// Harden-style brace of +3; the rest takes it to +1, and the next card restores +3.
		unicorn.encounterModifiers.ac = 3;
		await new GloamingRestCard().play(unicorn, foe, ring, contestants);
		expect(unicorn.encounterModifiers.ac).to.equal(1);

		await nextTurn();

		expect(unicorn.encounterModifiers.ac).to.equal(3);
	});

	it('gives back what a spent brace had left under the penalty', async () => {
		await new GloamingRestCard().play(unicorn, foe, ring, contestants);
		// A +5 brace arrives (net +3) and a melee hit spends that +3: the brace absorbed 3 of
		// its 5, so 2 remain once the penalty lifts.
		unicorn.encounterModifiers.ac = 0;

		await nextTurn();

		expect(unicorn.encounterModifiers.ac).to.equal(2);
	});

	it('is not broken by a hit the brace absorbed completely', async () => {
		await new GloamingRestCard().play(unicorn, foe, ring, contestants);
		unicorn.encounterModifiers.ac = 4;
		await unicorn.hit(3, foe, new HitCard());
		expect(unicorn.hp).to.equal(5);

		await nextTurn();

		expect(unicorn.hp).to.be.greaterThan(5);
	});

	it('keeps a curse that was there before the rest', async () => {
		unicorn.encounterModifiers.ac = -1;
		await new GloamingRestCard().play(unicorn, foe, ring, contestants);
		expect(unicorn.encounterModifiers.ac).to.equal(-3);

		await nextTurn();

		expect(unicorn.encounterModifiers.ac).to.equal(-1);
	});

	it('leaves nothing behind when the fight ends mid-rest', async () => {
		await new GloamingRestCard().play(unicorn, foe, ring, contestants);

		unicorn.endEncounter();

		expect(isResting(unicorn)).to.equal(false);
		expect(unicorn.encounterModifiers.ac).to.equal(undefined);
	});

	it('hydrates from JSON', () => {
		const restored = hydrateCard(JSON.parse(JSON.stringify(new GloamingRestCard())));
		expect(restored).to.be.instanceOf(GloamingRestCard);
	});
});
