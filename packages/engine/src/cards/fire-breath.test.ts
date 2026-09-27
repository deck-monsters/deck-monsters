import { expect } from 'chai';
import sinon from 'sinon';

import {
	FireBreathCard,
	WINDED_AC_PENALTY,
	BREATH_BASE_DAMAGE,
	breathReach,
	burnDamage,
	isBurning,
} from './fire-breath.js';
import { HitCard } from './hit.js';
import { HealCard } from './heal.js';
import { getMinimumDeck } from './helpers/deck.js';
import { hydrateCard } from './helpers/hydrate.js';
import Dragon from '../monsters/dragon.js';
import Minotaur from '../monsters/minotaur.js';
import Unicorn from '../monsters/unicorn.js';
import Gladiator from '../monsters/gladiator.js';
import WeepingAngel from '../monsters/weeping-angel.js';
import { WINDED_EFFECT } from '../constants/effect-types.js';
import { DRAGON } from '../constants/creature-types.js';
import { AOE } from '../constants/card-classes.js';

const isWinded = (monster: any) =>
	monster.encounterEffects.some((effect: any) => effect.effectType === WINDED_EFFECT);

describe('./cards/fire-breath.ts Fire Breath', () => {
	let dragon: any;
	let foes: any[];
	let ring: any;
	let contestants: any[];

	beforeEach(() => {
		dragon = new Dragon({ name: 'Skarn', gender: 'androgynous', xp: 0 });
		foes = [
			new Minotaur({ name: 'Bram', gender: 'male' }),
			new Unicorn({ name: 'Nola', gender: 'female' }),
			new Gladiator({ name: 'Cato', gender: 'male' }),
			new WeepingAngel({ name: 'Ura', gender: 'female' }),
		];
		contestants = [dragon, ...foes].map(monster => ({ monster, character: {} }));
		ring = { contestants, encounterEffects: [], channelManager: { sendMessages: () => Promise.resolve() } };
		for (const { monster } of contestants) monster.startEncounter(ring);
	});

	afterEach(() => sinon.restore());

	// Every target fails (or makes) its dodge.
	const dodging = (result: boolean) => sinon.stub(FireBreathCard.prototype, 'dodge').returns(result);

	const turnOf = (monster: any, Card: any = HitCard) => {
		const next = new Card();
		sinon.stub(next, 'effect').resolves(true);
		return next.play(monster, dragon, ring, contestants);
	};

	it('is a level 0, Dragon-only area card in the starting deck', () => {
		expect(FireBreathCard.permittedClassesAndTypes).to.deep.equal([DRAGON]);
		expect(FireBreathCard.level).to.equal(0);
		expect(new FireBreathCard().isCardClass(AOE)).to.equal(true);
		expect(dragon.canHoldCard(FireBreathCard)).to.equal(true);
		expect(new WeepingAngel({ xp: 500 }).canHoldCard(FireBreathCard)).to.equal(false);
		expect(getMinimumDeck().some((c: any) => c instanceof FireBreathCard)).to.equal(true);
	});

	it('reaches two opponents at first and one more every two levels', () => {
		expect([0, 1, 2, 3, 4, 5, 6].map(breathReach)).to.deep.equal([2, 2, 3, 3, 4, 4, 5]);
		expect([0, 2, 3, 6].map(burnDamage)).to.deep.equal([1, 1, 2, 3]);
	});

	it('is a cone: the target and the opponents beside it in ring order, wrapping round', () => {
		const card = new FireBreathCard();
		// Level 0: two opponents, starting at the chosen one.
		expect(card.getTargets(dragon, foes[1], ring, contestants)).to.deep.equal([foes[1], foes[2]]);
		expect(card.getTargets(dragon, foes[3], ring, contestants)).to.deep.equal([foes[3], foes[0]]);
	});

	it('never reaches an ally, however wide the cone', () => {
		contestants[1].team = 'Laurel';
		contestants[0].team = 'Laurel';
		const targets = new FireBreathCard().getTargets(dragon, foes[0], ring, contestants);
		expect(targets).not.to.include(foes[0]);
		expect(targets).to.deep.equal([foes[1], foes[2]]);
	});

	it('burns the targets that fail to dodge for 2 +1 per level, and sets them burning', async () => {
		dodging(false);
		const before = foes.map(f => f.hp);
		const damage = BREATH_BASE_DAMAGE + dragon.level;

		await new FireBreathCard().play(dragon, foes[0], ring, contestants);

		expect(foes.map(f => before[foes.indexOf(f)] - f.hp)).to.deep.equal([damage, damage, 0, 0]);
		expect(foes.map(isBurning)).to.deep.equal([true, true, false, false]);
	});

	it('takes half damage, and no burn, on a dodge', async () => {
		dodging(true);
		const before = foes[0].hp;

		await new FireBreathCard().play(dragon, foes[0], ring, contestants);

		expect(before - foes[0].hp).to.equal(Math.max(1, Math.floor((BREATH_BASE_DAMAGE + dragon.level) / 2)));
		expect(isBurning(foes[0])).to.equal(false);
	});

	it('rolls 1d20 + the target\'s dex against 15 + the dragon\'s int to dodge', () => {
		const card = new FireBreathCard();
		const rolls: any[] = [];
		card.on('rolled', (_c: string, _card: any, event: any) => rolls.push(event));

		card.dodge(dragon, foes[1]);

		expect(rolls[0].vs).to.equal(15 + dragon.intModifier);
		expect(rolls[0].roll.modifier).to.equal(foes[1].dexModifier);
	});

	it('burns at the start of the next two turns, with its own line, then goes out', async () => {
		dodging(false);
		const card = new FireBreathCard();
		await card.play(dragon, foes[0], ring, contestants);
		const lines: string[] = [];
		foes[0].on('hit', (_c: string, _m: any, { card: hitCard, damage }: any) => lines.push(`${hitCard.flavorText}|${damage}`));
		const hp = foes[0].hp;

		await turnOf(foes[0]);
		await turnOf(foes[0]);
		await turnOf(foes[0]);

		expect(hp - foes[0].hp).to.equal(2 * burnDamage(dragon.level));
		expect(lines).to.have.length(2);
		expect(lines[0]).to.include('Bram is still burning: 1 fire damage.');
		expect(lines[1]).to.include('The last of the flames go out.');
		expect(isBurning(foes[0])).to.equal(false);
	});

	it('is put out by a heal, and rekindled rather than stacked by a second breath', async () => {
		dodging(false);
		await new FireBreathCard().play(dragon, foes[0], ring, contestants);
		await new FireBreathCard().play(dragon, foes[0], ring, contestants);
		expect(foes[0].encounterEffects.filter((e: any) => isBurning({ encounterEffects: [e] }))).to.have.length(1);

		const hp = foes[0].hp;
		await turnOf(foes[0], HealCard);

		expect(isBurning(foes[0])).to.equal(false);
		expect(foes[0].hp).to.equal(hp);
	});

	it('cancels the card of a monster the burn kills', async () => {
		dodging(false);
		await new FireBreathCard().play(dragon, foes[0], ring, contestants);
		foes[0].hp = 1;
		const hit = new HitCard();
		const effect = sinon.stub(hit, 'effect').resolves(true);

		await hit.play(foes[0], dragon, ring, contestants);

		expect(foes[0].dead).to.equal(true);
		expect(effect.called).to.equal(false);
	});

	it('leaves the dragon winded once, however many it burned, until its next card', async () => {
		dodging(false);
		const baseAc = dragon.ac;
		const card = new FireBreathCard();
		const narrations: string[] = [];
		card.on('narration', (_c: string, _card: any, { narration }: any) => narrations.push(narration));

		await card.play(dragon, foes[0], ring, contestants);

		expect(dragon.ac).to.equal(baseAc - WINDED_AC_PENALTY);
		expect(dragon.encounterEffects.filter((e: any) => e.effectType === WINDED_EFFECT)).to.have.length(1);
		expect(narrations.join('\n')).to.include('Skarn is winded, and smoke trails from their nostrils.');

		await turnOf(dragon);

		expect(dragon.ac).to.equal(baseAc);
		expect(isWinded(dragon)).to.equal(false);
	});

	it('never stacks the winded penalty when it breathes twice in a row', async () => {
		dodging(false);
		const baseAc = dragon.ac;

		await new FireBreathCard().play(dragon, foes[0], ring, contestants);
		await new FireBreathCard().play(dragon, foes[0], ring, contestants);

		expect(dragon.ac).to.equal(baseAc - WINDED_AC_PENALTY);
		await turnOf(dragon);
		expect(dragon.ac).to.equal(baseAc);
	});

	it('cannot dodge its own breath in confusion', async () => {
		const dodge = sinon.spy(FireBreathCard.prototype, 'dodge');
		await new FireBreathCard().effect(dragon, dragon, ring);
		expect(dodge.called).to.equal(false);
		expect(isBurning(dragon)).to.equal(true);
	});

	it('does not wind a dragon that died mid-breath', () => {
		dragon.hp = 0;
		dragon.dead = true;
		new FireBreathCard().wind(dragon);
		expect(isWinded(dragon)).to.equal(false);
	});

	it('survives a JSON hydration round trip', () => {
		const restored = hydrateCard(JSON.parse(JSON.stringify(new FireBreathCard())));
		expect(restored).to.be.instanceOf(FireBreathCard);
		expect(restored.stats).to.equal(new FireBreathCard().stats);
	});
});
