import { expect } from 'chai';
import sinon from 'sinon';

import { FireBreathCard, WINDED_AC_PENALTY } from './fire-breath.js';
import { HitCard } from './hit.js';
import { getMinimumDeck } from './helpers/deck.js';
import { hydrateCard } from './helpers/hydrate.js';
import Dragon from '../monsters/dragon.js';
import Minotaur from '../monsters/minotaur.js';
import Unicorn from '../monsters/unicorn.js';
import WeepingAngel from '../monsters/weeping-angel.js';
import { WINDED_EFFECT } from '../constants/effect-types.js';
import { DRAGON } from '../constants/creature-types.js';
import { AOE } from '../constants/card-classes.js';

const isWinded = (monster: any) =>
	monster.encounterEffects.some((effect: any) => effect.effectType === WINDED_EFFECT);

describe('./cards/fire-breath.ts Fire Breath', () => {
	let dragon: any;
	let foeA: any;
	let foeB: any;
	let ring: any;
	let contestants: any[];

	beforeEach(() => {
		dragon = new Dragon({ name: 'Skarn', gender: 'androgynous', xp: 0 });
		foeA = new Minotaur({ name: 'Bram' });
		foeB = new Unicorn({ name: 'Nola' });
		contestants = [dragon, foeA, foeB].map(monster => ({ monster, character: {} }));
		ring = { contestants, encounterEffects: [], channelManager: { sendMessages: () => Promise.resolve() } };
		for (const { monster } of contestants) monster.startEncounter(ring);
	});

	afterEach(() => sinon.restore());

	const nextTurn = () => {
		const next = new HitCard();
		sinon.stub(next, 'effect').resolves(true);
		return next.play(dragon, foeA, ring, contestants);
	};

	it('is a level 0, Dragon-only area card in the starting deck', () => {
		expect(FireBreathCard.permittedClassesAndTypes).to.deep.equal([DRAGON]);
		expect(FireBreathCard.level).to.equal(0);
		expect(new FireBreathCard().isCardClass(AOE)).to.equal(true);
		expect(dragon.canHoldCard(FireBreathCard)).to.equal(true);
		expect(new WeepingAngel({ xp: 500 }).canHoldCard(FireBreathCard)).to.equal(false);
		expect(getMinimumDeck().some((c: any) => c instanceof FireBreathCard)).to.equal(true);
	});

	it('burns every opponent for 3 +1 per dragon level, and not the dragon', async () => {
		const hp = { dragon: dragon.hp, a: foeA.hp, b: foeB.hp };
		const damage = 3 + dragon.level;

		await new FireBreathCard().play(dragon, foeA, ring, contestants);

		expect(foeA.hp).to.equal(hp.a - damage);
		expect(foeB.hp).to.equal(hp.b - damage);
		expect(dragon.hp).to.equal(hp.dragon);
	});

	it('leaves the dragon winded once, however many it burned, until its next card', async () => {
		const baseAc = dragon.ac;
		const card = new FireBreathCard();
		const narrations: string[] = [];
		card.on('narration', (_c: string, _card: any, { narration }: any) => narrations.push(narration));

		await card.play(dragon, foeA, ring, contestants);

		expect(dragon.ac).to.equal(baseAc - WINDED_AC_PENALTY);
		expect(dragon.encounterEffects.filter((e: any) => e.effectType === WINDED_EFFECT)).to.have.length(1);
		expect(narrations.join('\n')).to.include('Skarn is winded, and smoke trails from their nostrils.');

		await nextTurn();

		expect(dragon.ac).to.equal(baseAc);
		expect(isWinded(dragon)).to.equal(false);
	});

	it('never stacks the penalty when it breathes twice in a row', async () => {
		const baseAc = dragon.ac;

		await new FireBreathCard().play(dragon, foeA, ring, contestants);
		await new FireBreathCard().play(dragon, foeA, ring, contestants);

		expect(dragon.ac).to.equal(baseAc - WINDED_AC_PENALTY);
		await nextTurn();
		expect(dragon.ac).to.equal(baseAc);
	});

	it('does not wind a dragon that died mid-breath', async () => {
		const card = new FireBreathCard();
		dragon.hp = 0;
		dragon.dead = true;
		card.wind(dragon);
		expect(isWinded(dragon)).to.equal(false);
	});

	it('survives a JSON hydration round trip', () => {
		const restored = hydrateCard(JSON.parse(JSON.stringify(new FireBreathCard())));
		expect(restored).to.be.instanceOf(FireBreathCard);
		expect(restored.stats).to.equal(new FireBreathCard().stats);
	});
});
