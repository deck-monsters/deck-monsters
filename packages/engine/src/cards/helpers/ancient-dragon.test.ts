import { expect } from 'chai';
import sinon from 'sinon';

import {
	ANCIENT_DRAGON_LEVEL,
	EXPOSED_AC_PENALTY,
	isAncientDragon,
	isExposed,
	outwit,
} from './ancient-dragon.js';
import { FireBreathCard, isBurning } from '../fire-breath.js';
import { HitCard } from '../hit.js';
import { discountedLevelThreshold } from '../../helpers/levels.js';
import Dragon from '../../monsters/dragon.js';
import Minotaur from '../../monsters/minotaur.js';
import WeepingAngel from '../../monsters/weeping-angel.js';

const ancientXp = discountedLevelThreshold(ANCIENT_DRAGON_LEVEL);

describe('./cards/helpers/ancient-dragon.ts', () => {
	let dragon: any;
	let foe: any;
	let ring: any;
	let contestants: any[];

	const setUp = (xp: number) => {
		dragon = new Dragon({ name: 'Skarn', gender: 'male', xp });
		foe = new WeepingAngel({ name: 'Ura', gender: 'female', xp });
		contestants = [dragon, foe].map(monster => ({ monster, character: {} }));
		ring = { contestants, encounterEffects: [], channelManager: { sendMessages: () => Promise.resolve() } };
		dragon.startEncounter(ring);
		foe.startEncounter(ring);
	};

	afterEach(() => sinon.restore());

	// A Hit that always lands.
	const landingHit = () => {
		const hit = new HitCard();
		sinon.stub(hit, 'hitCheck').returns({ attackRoll: { result: 25 }, success: true, strokeOfLuck: false, curseOfLoki: false } as any);
		return hit;
	};

	it('is ancient from level 10, and only a dragon', () => {
		expect(isAncientDragon(new Dragon({ xp: discountedLevelThreshold(ANCIENT_DRAGON_LEVEL - 1) }))).to.equal(false);
		expect(isAncientDragon(new Dragon({ xp: ancientXp }))).to.equal(true);
		expect(isAncientDragon(new Minotaur({ xp: ancientXp }))).to.equal(false);
	});

	it('says so when you look at it', () => {
		expect(new Dragon({ gender: 'androgynous', xp: ancientXp }).description).to.include(
			'They are ancient. Their fire cannot be dodged, but they can still be tricked.',
		);
		expect(new Dragon({ xp: 0 }).description).not.to.include('ancient');
	});

	it('breathes fire that cannot be dodged and burns for three turns', async () => {
		setUp(ancientXp);
		const dodge = sinon.spy(FireBreathCard.prototype, 'dodge');
		sinon.stub(Math, 'random').returns(0); // a 1: nobody outwits it

		await new FireBreathCard().play(dragon, foe, ring, contestants);

		expect(dodge.called).to.equal(false);
		expect(isBurning(foe)).to.equal(true);
		for (let turn = 0; turn < 3; turn += 1) {
			expect(isBurning(foe), `turn ${turn}`).to.equal(true);
			const next = new HitCard();
			sinon.stub(next, 'effect').resolves(true);
			await next.play(foe, dragon, ring, contestants);
		}
		expect(isBurning(foe)).to.equal(false);
	});

	it('can be outwitted: the attack goes wide and the dragon is exposed until its next card', async () => {
		setUp(ancientXp);
		const baseAc = dragon.ac;
		const hp = foe.hp;
		sinon.stub(Math, 'random').returns(0.999); // a 20 on the d20

		await landingHit().play(dragon, foe, ring, contestants);

		expect(foe.hp).to.equal(hp);
		expect(isExposed(dragon)).to.equal(true);
		expect(dragon.ac).to.equal(baseAc - EXPOSED_AC_PENALTY);

		sinon.restore();
		const next = new HitCard();
		sinon.stub(next, 'effect').resolves(true);
		await next.play(dragon, foe, ring, contestants);
		expect(dragon.ac).to.equal(baseAc);
	});

	it('gives each opponent only one try per fight', async () => {
		setUp(ancientXp);
		const reasons: string[] = [];
		const attack = async () => {
			const hit = landingHit();
			hit.on('rolled', (_c: string, _card: any, { reason }: any) => reasons.push(reason));
			await hit.play(dragon, foe, ring, contestants);
		};

		await attack();
		await attack();

		expect(reasons.filter(reason => reason.includes('to outwit an ancient dragon'))).to.have.length(1);
	});

	it('rolls 1d20 + the target\'s int against 20 + the dragon\'s int', () => {
		setUp(ancientXp);
		const card = new HitCard();
		const rolls: any[] = [];
		card.on('rolled', (_c: string, _card: any, event: any) => rolls.push(event));

		outwit(dragon, foe, card);

		expect(rolls[0].vs).to.equal(20 + dragon.intModifier);
		expect(rolls[0].roll.modifier).to.equal(foe.intModifier);
	});

	it('has a soft underbelly: a natural 20 against it does triple damage', async () => {
		setUp(ancientXp);
		const hit = new HitCard();
		sinon.stub(hit, 'hitCheck').returns({ attackRoll: { result: 20 }, success: true, strokeOfLuck: true, curseOfLoki: false } as any);
		const narrations: string[] = [];
		dragon.on('narration', (_c: string, _m: any, { narration }: any) => narrations.push(narration));
		const hp = dragon.hp;

		await hit.play(foe, dragon, ring, contestants);

		const max = 6 + foe.strModifier;
		expect(hp - dragon.hp).to.equal(3 * max);
		expect(narrations.join('\n')).to.include('Ura finds the soft underbelly of Skarn! Triple damage.');
	});

	it('gives a young dragon none of it', async () => {
		setUp(0);
		const hit = new HitCard();
		sinon.stub(hit, 'hitCheck').returns({ attackRoll: { result: 20 }, success: true, strokeOfLuck: true, curseOfLoki: false } as any);
		const hp = dragon.hp;

		await hit.play(foe, dragon, ring, contestants);

		expect(hp - dragon.hp).to.equal(6 + foe.strModifier);
	});
});
