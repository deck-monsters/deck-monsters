import { expect } from 'chai';
import sinon from 'sinon';

import { UnconquerableHornCard } from './unconquerable-horn.js';
import { ImmobilizeCard } from './immobilize.js';
import { CoilCard } from './coil.js';
import { EnthrallCard } from './enthrall.js';
import { StickethCard } from './sticketh.js';
import { hydrateCard } from './helpers/hydrate.js';
import { CONTROL_WARD } from './helpers/control-ward.js';
import Unicorn from '../monsters/unicorn.js';
import Basilisk from '../monsters/basilisk.js';
import WeepingAngel from '../monsters/weeping-angel.js';
import { UNICORN } from '../constants/creature-types.js';

const isHeld = (monster: any) =>
	monster.encounterEffects.some((effect: any) => effect.effectType === 'ImmobilizeEffect');

describe('./cards/unconquerable-horn.ts Unconquerable Horn', () => {
	let unicorn: any;
	let foe: any;
	let ring: any;
	let contestants: any[];

	beforeEach(() => {
		unicorn = new Unicorn({ name: 'Nola', gender: 'female' });
		foe = new Basilisk({ name: 'Sszar' });
		contestants = [unicorn, foe].map(monster => ({ monster, character: {} }));
		ring = {
			contestants,
			encounterEffects: [],
			channelManager: { sendMessages: () => Promise.resolve() },
		};
		unicorn.startEncounter(ring);
		foe.startEncounter(ring);
	});

	afterEach(() => sinon.restore());

	it('is a Unicorn-only level 1 card that targets its player', () => {
		const card = new UnconquerableHornCard();

		expect(card.cardType).to.equal('Unconquerable Horn');
		expect(UnconquerableHornCard.permittedClassesAndTypes).to.deep.equal([UNICORN]);
		expect(UnconquerableHornCard.level).to.equal(1);
		expect(card.getTargets(unicorn)).to.deep.equal([unicorn]);
		expect(card.stats).to.include('Once per fight');
	});

	it('cancels the next hold an opponent lands, then is spent', async () => {
		await new UnconquerableHornCard().play(unicorn, foe, ring, contestants);
		expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal('armed');

		const hold = new ImmobilizeCard();
		sinon.stub(hold, 'immobilizeCheck').returns(true);
		const narrations: string[] = [];
		hold.on('narration', (_c: string, _card: any, { narration }: any) => narrations.push(narration));

		await hold.effect(foe, unicorn, ring, contestants);

		expect(isHeld(unicorn)).to.equal(false);
		expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal('spent');
		expect(narrations.join('\n')).to.include('Nola cannot be taken and held. She refuses to be immobilized');

		// The second hold lands.
		await hold.effect(foe, unicorn, ring, contestants);
		expect(isHeld(unicorn)).to.equal(true);
	});

	it('does not trigger on a hold attempt that already failed', async () => {
		await new UnconquerableHornCard().play(unicorn, foe, ring, contestants);
		const hold = new ImmobilizeCard();
		sinon.stub(hold, 'immobilizeCheck').returns(false);

		await hold.effect(foe, unicorn, ring, contestants);

		expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal('armed');
	});

	it('cancels the hold but not the damage that comes with it', async () => {
		await new UnconquerableHornCard().play(unicorn, foe, ring, contestants);
		const coil = new CoilCard({ doDamageOnImmobilize: true } as any);
		sinon.stub(coil, 'immobilizeCheck').returns(true);
		const superEffect = sinon.stub(Object.getPrototypeOf(ImmobilizeCard.prototype), 'effect').resolves(true);

		await coil.immobilize(foe, unicorn, ring, contestants);

		expect(isHeld(unicorn)).to.equal(false);
		expect(superEffect).to.have.been.calledOnce;
	});

	it('also refuses an area hold such as Enthrall', async () => {
		const angel = new WeepingAngel({ name: 'Ada' });
		angel.startEncounter(ring);
		contestants.push({ monster: angel, character: {} });
		await new UnconquerableHornCard().play(unicorn, foe, ring, contestants);
		const enthrall = new EnthrallCard();
		sinon.stub(enthrall, 'immobilizeCheck').returns(true);

		await enthrall.effect(angel, angel, ring, contestants);

		expect(isHeld(unicorn)).to.equal(false);
		expect(isHeld(foe)).to.equal(true);
	});

	it('does not stack and does not re-arm once spent', async () => {
		const card = new UnconquerableHornCard();
		const narrations: string[] = [];
		card.on('narration', (_c: string, _card: any, { narration }: any) => narrations.push(narration));

		await card.play(unicorn, foe, ring, contestants);
		await card.play(unicorn, foe, ring, contestants);
		expect(narrations[1]).to.include('already braced');

		unicorn.encounterModifiers[CONTROL_WARD] = 'spent';
		await card.play(unicorn, foe, ring, contestants);
		expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal('spent');
		expect(narrations[2]).to.include('already refused one hold');
	});

	it('never cancels the Unicorn\'s own Sticketh hold', async () => {
		await new UnconquerableHornCard().play(unicorn, foe, ring, contestants);

		new StickethCard().stickFast(unicorn, ring);

		expect(isHeld(unicorn)).to.equal(true);
		expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal('armed');
	});

	it('is gone after the encounter ends', async () => {
		await new UnconquerableHornCard().play(unicorn, foe, ring, contestants);
		unicorn.endEncounter();

		expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal(undefined);
	});

	it('hydrates from JSON', () => {
		const restored = hydrateCard(JSON.parse(JSON.stringify(new UnconquerableHornCard())));
		expect(restored).to.be.instanceOf(UnconquerableHornCard);
	});
});
