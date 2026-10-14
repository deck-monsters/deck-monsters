import { expect } from 'chai';
import sinon from 'sinon';

import { CoilCard } from '../coil.js';
import { ATTACK_PHASE } from '../../constants/phases.js';
import { MesmerizeCard } from '../mesmerize.js';
import { HelmOfAweCard } from '../helm-of-awe.js';
import Basilisk from '../../monsters/basilisk.js';
import Minotaur from '../../monsters/minotaur.js';
import Dragon from '../../monsters/dragon.js';

/*
 * Owner, 2026-10-13: an effect that lives on its caster ends the moment the caster falls, with
 * one line, "<caster> has fallen, and …" (helpers/caster-falls.ts).
 */
describe('./cards/helpers/caster-falls.ts', () => {
	let narrations: string[];
	let ring: any;
	const setUp = (...monsters: any[]) => {
		ring = { contestants: monsters.map(monster => ({ monster, character: {} })), encounterEffects: [], channelManager: { sendMessages: () => Promise.resolve() } };
		monsters.forEach(monster => monster.startEncounter(ring));
	};
	const listen = (card: any) => {
		card.on('narration', (_c: string, _card: any, { narration }: any) => narrations.push(narration));
		return card;
	};

	beforeEach(() => { narrations = []; });
	afterEach(() => sinon.restore());

	it('lets a coil go slack the moment the coiler falls', async () => {
		const snake = new Basilisk({ name: 'George', gender: 'male' });
		const bull = new Minotaur({ name: 'Jefferson', gender: 'male' });
		const killer = new Dragon({ name: 'Skarn', gender: 'female' });
		setUp(snake, bull, killer);
		const coil = listen(new CoilCard());
		sinon.stub(coil, 'immobilizeCheck').returns(true);

		coil.immobilize(snake, bull, ring, ring.contestants);
		expect(bull.encounterEffects.some((e: any) => e.effectType === 'ImmobilizeEffect')).to.equal(true);

		await (snake as any).die(killer);

		expect(bull.encounterEffects.some((e: any) => e.effectType === 'ImmobilizeEffect')).to.equal(false);
		expect(narrations).to.include('➰ George has fallen, and Jefferson is no longer coiled.');
	});

	it('breaks a mind hold the same way, with no "limp dead body"', async () => {
		const snake = new Basilisk({ name: 'George', gender: 'male' });
		const bull = new Minotaur({ name: 'Jefferson', gender: 'male' });
		const killer = new Dragon({ name: 'Skarn', gender: 'female' });
		setUp(snake, bull, killer);
		const mesmerize = listen(new MesmerizeCard());
		sinon.stub(mesmerize, 'immobilizeCheck').returns(true);

		mesmerize.immobilize(snake, bull, ring, ring.contestants);
		await (snake as any).die(killer);

		expect(narrations).to.include('🌠 George has fallen, and Jefferson is no longer mesmerized.');
		expect(narrations.join(' ')).to.not.include('limp dead body');
	});

	it("ends an awe when the dragon falls: its gaze is gone", async () => {
		const dragon = new Dragon({ name: 'Skarn', gender: 'female' });
		const bull = new Minotaur({ name: 'Jefferson', gender: 'male' });
		const killer = new Basilisk({ name: 'George', gender: 'male' });
		setUp(dragon, bull, killer);
		const helm = listen(new HelmOfAweCard());

		helm.awe(bull, dragon, 12);
		expect(HelmOfAweCard.isAwed(bull)).to.equal(true);

		await (dragon as any).die(killer);

		expect(HelmOfAweCard.isAwed(bull)).to.equal(false);
		expect(narrations).to.include('🐲 Skarn has fallen, and Jefferson no longer cowers.');
	});

	it('unhooks from the caster as soon as the captive breaks free (PR #433 review)', async () => {
		const snake = new Basilisk({ name: 'George', gender: 'male' });
		const bull = new Minotaur({ name: 'Jefferson', gender: 'male' });
		setUp(snake, bull);
		const coil = listen(new CoilCard());
		sinon.stub(coil, 'immobilizeCheck').returns(true);
		const listeners = () => (snake as any).semaphore.listenerCount('die');
		const before = listeners();

		coil.immobilize(snake, bull, ring, ring.contestants);
		expect(listeners()).to.equal(before + 1);
		sinon.stub(coil, 'checkSuccess').returns({ success: true, strokeOfLuck: false, curseOfLoki: false, tie: false } as any);
		const hold: any = bull.encounterEffects.find((e: any) => e.effectType === 'ImmobilizeEffect');
		await hold({ card: { play: () => Promise.resolve(true) }, phase: ATTACK_PHASE, player: bull, ring });

		expect(bull.encounterEffects.includes(hold)).to.equal(false);
		expect(listeners()).to.equal(before);
	});

	it('leaves the captive alone when someone else falls, and unhooks at the fight end', async () => {
		const snake = new Basilisk({ name: 'George', gender: 'male' });
		const bull = new Minotaur({ name: 'Jefferson', gender: 'male' });
		const killer = new Dragon({ name: 'Skarn', gender: 'female' });
		setUp(snake, bull, killer);
		const coil = listen(new CoilCard());
		sinon.stub(coil, 'immobilizeCheck').returns(true);
		const listeners = () => (snake as any).semaphore.listenerCount('die');
		const before = listeners();

		coil.immobilize(snake, bull, ring, ring.contestants);
		await (killer as any).die(snake);
		expect(bull.encounterEffects.some((e: any) => e.effectType === 'ImmobilizeEffect')).to.equal(true);

		(snake as any).endEncounter();
		expect(listeners()).to.equal(before);
	});

	it('says nothing when the captive falls first, then the coiler (roadmap 51)', async () => {
		const snake = new Basilisk({ name: 'George', gender: 'male' });
		const bull = new Minotaur({ name: 'Jefferson', gender: 'male' });
		const killer = new Dragon({ name: 'Skarn', gender: 'female' });
		setUp(snake, bull, killer);
		const coil = listen(new CoilCard());
		sinon.stub(coil, 'immobilizeCheck').returns(true);
		const listeners = () => (snake as any).semaphore.listenerCount('die');
		const before = listeners();

		coil.immobilize(snake, bull, ring, ring.contestants);
		await (bull as any).die(killer);
		expect(listeners()).to.equal(before);

		await (snake as any).die(killer);
		expect(narrations.join(' ')).to.not.include('no longer coiled');
	});
});
