import { expect } from 'chai';
import sinon from 'sinon';

import { GloamingRestCard } from './gloaming-rest.js';
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
		expect(unicorn.hp).to.be.within(5 + 3, 5 + 12);
		expect(isResting(unicorn)).to.equal(false);
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
		expect(narrations.join('\n')).to.include('They rise without its comfort');
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
