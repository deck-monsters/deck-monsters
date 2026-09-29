import { expect } from 'chai';
import sinon from 'sinon';

import { UnconquerableHornCard } from './unconquerable-horn.js';
import { ImmobilizeCard } from './immobilize.js';
import { CoilCard } from './coil.js';
import { EnthrallCard } from './enthrall.js';
import { MesmerizeCard } from './mesmerize.js';
import { StickethCard } from './sticketh.js';
import { CurseCard } from './curse.js';
import { BlinkCard } from './blink.js';
import { BadBatchCard } from './bad-batch.js';
import { WhiskeyShotCard } from './whiskey-shot.js';
import { SandstormCard } from './sandstorm.js';
import { EnchantedFaceswapCard } from './enchanted-faceswap.js';
import { HitCard } from './hit.js';
import { hydrateCard } from './helpers/hydrate.js';
import { CONTROL_WARD } from './helpers/control-ward.js';
import Unicorn from '../monsters/unicorn.js';
import Basilisk from '../monsters/basilisk.js';
import WeepingAngel from '../monsters/weeping-angel.js';
import { UNICORN } from '../constants/creature-types.js';
import { FACESWAP_EFFECT, SANDSTORM_EFFECT } from '../constants/effect-types.js';

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

	it('quotes Job only for a Unicorn: a ward lent in confusion protects anyone', async () => {
		// The Basilisk carries a ward lent to it; the Unicorn tries to hold it.
		new UnconquerableHornCard().effect(unicorn, foe);
		const hold = new ImmobilizeCard();
		sinon.stub(hold, 'immobilizeCheck').returns(true);
		const narrations: string[] = [];
		hold.on('narration', (_c: string, _card: any, { narration }: any) => narrations.push(narration));

		await hold.effect(unicorn, foe, ring, contestants);

		expect(isHeld(foe)).to.equal(false);
		expect(narrations.join('\n')).to.include('Sszar will not be taken and held.');
		expect(narrations.join('\n')).not.to.include('Will the unicorn');
	});

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
		expect(narrations.join('\n')).to.include('"Will the unicorn be willing to serve thee?" Nola will not be taken and held. She refuses to be immobilized');

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

	it('is not spent by a teammate\'s area hold, only by an opponent\'s', async () => {
		const angel = new WeepingAngel({ name: 'Ada' });
		angel.startEncounter(ring);
		const teamed = [
			{ monster: unicorn, character: { team: 'Laurel' } },
			{ monster: angel, character: { team: 'Laurel' } },
			{ monster: foe, character: { team: 'Gorge' } },
		];
		await new UnconquerableHornCard().play(unicorn, foe, ring, teamed);
		const mesmerize = new MesmerizeCard();
		sinon.stub(mesmerize, 'immobilizeCheck').returns(true);

		// Mesmerize holds everyone, allies included; the ally's hold lands and the ward stays.
		await mesmerize.effect(angel, unicorn, ring, teamed);
		expect(isHeld(unicorn)).to.equal(true);
		expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal('armed');

		// Under a free-for-all ring event, the same hold counts as an opponent's.
		unicorn.encounterEffects = [];
		await mesmerize.effect(angel, unicorn, { ...ring, encounterFreeForAll: true }, teamed);
		expect(isHeld(unicorn)).to.equal(false);
		expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal('spent');
	});

	it('does not stack and does not re-arm once spent', async () => {
		const card = new UnconquerableHornCard();
		const narrations: string[] = [];
		card.on('narration', (_c: string, _card: any, { narration }: any) => narrations.push(narration));

		await card.play(unicorn, foe, ring, contestants);
		await card.play(unicorn, foe, ring, contestants);
		expect(narrations[1]).to.include('already standeth braced. No band shall hold her.');

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

	describe('as a counterspell (roadmap 35)', () => {
		it('cancels a curse, but the hit that carried it still lands', async () => {
			await new UnconquerableHornCard().effect(unicorn, unicorn);

			const curse = new CurseCard();
			sinon.stub(curse, 'checkSuccess').returns({
				success: true,
				strokeOfLuck: false,
				curseOfLoki: false,
				tie: false,
			});
			const beforeAc = unicorn.ac;
			const beforeHp = unicorn.hp;

			await curse.effect(foe, unicorn, ring, contestants);

			expect(unicorn.ac).to.equal(beforeAc);
			expect(unicorn.hp).to.be.below(beforeHp);
			expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal('spent');

			// The ward fired once; a second curse from the same opponent now lands.
			const secondCurse = new CurseCard();
			sinon.stub(secondCurse, 'checkSuccess').returns({
				success: true,
				strokeOfLuck: false,
				curseOfLoki: false,
				tie: false,
			});
			await secondCurse.effect(foe, unicorn, ring, contestants);
			expect(unicorn.ac).to.be.below(beforeAc);
		});

		it('does not touch Curse of Loki: the attacker still hurts itself', async () => {
			await new UnconquerableHornCard().effect(unicorn, unicorn);

			const curse = new CurseCard();
			sinon.stub(curse, 'checkSuccess').returns({
				success: false,
				strokeOfLuck: false,
				curseOfLoki: true,
				tie: false,
			});
			const beforeFoeHp = foe.hp;
			const beforeUnicornAc = unicorn.ac;

			await curse.effect(foe, unicorn, ring, contestants);

			expect(foe.hp).to.be.below(beforeFoeHp);
			expect(unicorn.ac).to.equal(beforeUnicornAc);
			// Curse of Loki is a roll outcome, not an action aimed at the target: untouched.
			expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal('armed');
		});

		it("an ally's curse and the warder's own curse do not spend the ward", async () => {
			const teamed = [
				{ monster: unicorn, character: { team: 'Laurel' } },
				{ monster: foe, character: { team: 'Laurel' } },
			];
			await new UnconquerableHornCard().effect(unicorn, unicorn);

			const ownCurse = new CurseCard();
			sinon.stub(ownCurse, 'checkSuccess').returns({ success: true, strokeOfLuck: false, curseOfLoki: false, tie: false });
			await ownCurse.effect(unicorn, unicorn, ring, teamed);
			expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal('armed');

			const allyCurse = new CurseCard();
			sinon.stub(allyCurse, 'checkSuccess').returns({ success: true, strokeOfLuck: false, curseOfLoki: false, tie: false });
			await allyCurse.effect(foe, unicorn, ring, teamed);
			expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal('armed');
		});

		it("cancels Blink's time-shift, leaving no BlinkEffect or timeShifted flag", async () => {
			await new UnconquerableHornCard().effect(unicorn, unicorn);

			const blink = new BlinkCard();
			sinon.stub(blink, 'checkSuccess').returns({ success: true, strokeOfLuck: false, curseOfLoki: false, tie: false });

			await blink.effect(foe, unicorn, ring, contestants);

			expect(unicorn.encounterModifiers.timeShifted).to.not.equal(true);
			expect(
				unicorn.encounterEffects.some((effect: any) => effect.effectType === 'BlinkEffect')
			).to.equal(false);
			expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal('spent');
		});

		it("cancels Bad Batch's poison; the drink heals as normal", async () => {
			await new UnconquerableHornCard().effect(unicorn, unicorn);

			// foe brews the trap on itself (Bad Batch targets its own player).
			new BadBatchCard().effect(foe, foe, ring);

			const whiskey = new WhiskeyShotCard();
			sinon.stub(Object.getPrototypeOf(whiskey), 'checkSuccess').returns({
				curseOfLoki: false,
				healRoll: { result: 5 },
				result: 5,
				strokeOfLuck: false,
				success: true,
			});
			unicorn.hp = Math.max(1, unicorn.maxHp - 10);
			const beforeHp = unicorn.hp;

			await whiskey.play(unicorn, unicorn, ring, contestants);

			expect(unicorn.hp).to.be.above(beforeHp);
			expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal('spent');
			sinon.restore();
		});

		it('cancels Sandstorm confusion, but the storm damage still lands', async () => {
			await new UnconquerableHornCard().effect(unicorn, unicorn);

			const beforeHp = unicorn.hp;
			await new SandstormCard().effect(foe, unicorn, ring, contestants);

			expect(unicorn.hp).to.be.below(beforeHp);
			expect(
				unicorn.encounterEffects.some((effect: any) => effect.effectType === SANDSTORM_EFFECT)
			).to.equal(false);
			expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal('spent');
		});

		it("cancels being faceswapped onto a warded attacker; the hit lands on its real target", async () => {
			await new UnconquerableHornCard().effect(unicorn, unicorn);
			new EnchantedFaceswapCard().effect(foe, foe);

			const hit = new HitCard();
			sinon.stub(Object.getPrototypeOf(hit), 'checkSuccess').returns({
				success: true,
				strokeOfLuck: false,
				curseOfLoki: false,
				tie: false,
			});
			const beforeFoeHp = foe.hp;
			const beforeUnicornHp = unicorn.hp;

			await hit.play(unicorn, foe, ring, contestants);

			expect(foe.hp).to.be.below(beforeFoeHp);
			expect(unicorn.hp).to.equal(beforeUnicornHp);
			expect(
				foe.encounterEffects.some((effect: any) => effect.effectType === FACESWAP_EFFECT)
			).to.equal(false);
			expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal('spent');
			sinon.restore();
		});

		it("lapses after one round of the warder's own cards and cannot be re-armed that fight", async () => {
			await new UnconquerableHornCard().effect(unicorn, unicorn);
			expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal('armed');

			const hit = new HitCard();
			sinon.stub(Object.getPrototypeOf(hit), 'checkSuccess').returns({
				success: true,
				strokeOfLuck: false,
				curseOfLoki: false,
				tie: false,
			});

			for (let i = 0; i < unicorn.cardSlots; i += 1) {
				// eslint-disable-next-line no-await-in-loop
				await hit.play(unicorn, foe, ring, contestants);
			}
			sinon.restore();

			expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal('lapsed');

			// A hold now lands: the lapsed ward no longer blocks anything.
			const hold = new ImmobilizeCard();
			sinon.stub(hold, 'immobilizeCheck').returns(true);
			await hold.effect(foe, unicorn, ring, contestants);
			expect(isHeld(unicorn)).to.equal(true);

			// It does not re-arm this fight.
			const rearm = new UnconquerableHornCard();
			rearm.effect(unicorn, unicorn);
			expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal('lapsed');
		});
	});

	describe('the steadying heal (roadmap 35)', () => {
		it('heals 1d6 on every play, armed or not, so the card is never dead', async () => {
			for (let i = 0; i < 20; i += 1) {
				const unicorn = new Unicorn({ name: 'Nola' });
				unicorn.startEncounter({ contestants: [], encounterEffects: [] });
				unicorn.hp = 5;
				const card = new UnconquerableHornCard();
				await card.play(unicorn, unicorn);
				expect(unicorn.hp).to.be.within(6, 11);
				// A second play in the same fight cannot re-arm, and still heals.
				const before = unicorn.hp;
				await card.play(unicorn, unicorn);
				expect(unicorn.hp - before).to.be.within(1, 6);
				unicorn.disposeTimers();
			}
		});
	});
});

