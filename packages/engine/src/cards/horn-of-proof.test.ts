import { expect } from 'chai';
import sinon from 'sinon';

import { HornOfProofCard } from './horn-of-proof.js';
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
import Gladiator from '../monsters/gladiator.js';
import WeepingAngel from '../monsters/weeping-angel.js';
import Jinn from '../monsters/jinn.js';
import { FACESWAP_EFFECT, SANDSTORM_EFFECT, BAD_BATCH_EFFECT, EXPOSED_EFFECT, GLOAMING_REST_EFFECT, WINDED_EFFECT } from '../constants/effect-types.js';
import { CLERIC } from '../constants/creature-classes.js';
import Basilisk from '../monsters/basilisk.js';
import { UNICORN } from '../constants/creature-types.js';

const isHeld = (monster: any) =>
	monster.encounterEffects.some((effect: any) => effect.effectType === 'ImmobilizeEffect');

const holdEffect = () => Object.assign(() => undefined, { effectType: 'ImmobilizeEffect' });

describe('./cards/horn-of-proof.ts Horn of Proof', () => {
	let unicorn: any;
	let foe: any;
	let ring: any;
	let contestants: any[];

	beforeEach(() => {
		unicorn = new Unicorn({ name: 'Nola', gender: 'female', xp: 300 });
		foe = new Gladiator({ name: 'Tor' });
		contestants = [{ monster: unicorn, character: {} }, { monster: foe, character: {} }];
		ring = {
			contestants,
			encounterEffects: [],
			channelManager: { sendMessages: () => Promise.resolve() },
		};
		unicorn.startEncounter(ring);
		foe.startEncounter(ring);
		unicorn.hp = unicorn.maxHp - 10;
	});

	afterEach(() => sinon.restore());

	it('is a level 2 Unicorn or Cleric card', () => {
		expect(HornOfProofCard.permittedClassesAndTypes).to.deep.equal([UNICORN, CLERIC]);
		expect(HornOfProofCard.level).to.equal(2);
		expect(new WeepingAngel({ xp: 300 }).canHoldCard(HornOfProofCard)).to.equal(true);
		expect(new Jinn({ xp: 300 }).canHoldCard(HornOfProofCard)).to.equal(false);
		expect(new HornOfProofCard().stats).to.include('Then heal 5 hp.');
	});

	it('heals a fixed 5 hp', async () => {
		const before = unicorn.hp;
		await new HornOfProofCard().play(unicorn, foe, ring, contestants);
		expect(unicorn.hp).to.equal(before + 5);
	});

	it('removes a hold first, and only the hold', async () => {
		const hold = holdEffect();
		unicorn.encounterEffects = [hold];
		unicorn.encounterModifiers.immobilizedTurns = 2;
		unicorn.encounterModifiers.dex = -2;
		ring.encounterEffects = [Object.assign(() => undefined, { effectType: BAD_BATCH_EFFECT })];

		await new HornOfProofCard().effect(unicorn, unicorn, ring);

		// Only the hold goes; the ward's lapse timer, armed after the cleanse, is not a hold.
		expect(isHeld(unicorn)).to.equal(false);
		expect(unicorn.encounterModifiers.immobilizedTurns).to.equal(0);
		expect(unicorn.encounterModifiers.dex).to.equal(-2);
		expect(ring.encounterEffects).to.have.length(1);
	});

	it('otherwise lifts the harshest stat curse', async () => {
		unicorn.encounterModifiers.dex = -1;
		unicorn.encounterModifiers.str = -3;
		unicorn.encounterModifiers.ac = 2; // a brace is not a curse

		await new HornOfProofCard().effect(unicorn, unicorn, ring);

		expect(unicorn.encounterModifiers.str).to.equal(0);
		expect(unicorn.encounterModifiers.dex).to.equal(-1);
		expect(unicorn.encounterModifiers.ac).to.equal(2);
	});

	it('does not mistake a Gloaming Rest penalty for a curse', async () => {
		const rest = Object.assign(() => undefined, { effectType: GLOAMING_REST_EFFECT });
		unicorn.encounterEffects = [rest];
		unicorn.encounterModifiers.ac = -2; // the rest's own penalty, nothing more

		await new HornOfProofCard().effect(unicorn, unicorn, ring);
		expect(unicorn.encounterModifiers.ac).to.equal(-2);

		unicorn.encounterModifiers.ac = -3; // the rest's -2 plus a -1 Soften
		await new HornOfProofCard().effect(unicorn, unicorn, ring);
		expect(unicorn.encounterModifiers.ac).to.equal(-2);
	});

	// Review of PR #402: a Sandstorm-redirected horn on a winded Dragon lifted the -2, and the
	// winded effect then gave 2 back on top, leaving +2 AC for the rest of the fight.
	it('does not mistake winded or exposed for a curse either', async () => {
		for (const [effectType, penalty] of [[WINDED_EFFECT, 2], [EXPOSED_EFFECT, 4]] as const) {
			unicorn.encounterEffects = [Object.assign(() => undefined, { effectType })];
			unicorn.encounterModifiers.ac = -penalty;

			await new HornOfProofCard().effect(unicorn, unicorn, ring);
			expect(unicorn.encounterModifiers.ac, effectType).to.equal(-penalty);
		}
	});

	it('otherwise pours away one Bad Batch waiting in the ring, and only one', async () => {
		const other = () => undefined;
		const first = Object.assign(() => undefined, { effectType: BAD_BATCH_EFFECT });
		const second = Object.assign(() => undefined, { effectType: BAD_BATCH_EFFECT });
		ring.encounterEffects = [first, other, second];

		await new HornOfProofCard().effect(unicorn, unicorn, ring);

		expect(ring.encounterEffects).to.deep.equal([other, second]);
	});

	it('still heals when there is nothing to purify', async () => {
		const card = new HornOfProofCard();
		const narrations: string[] = [];
		card.on('narration', (_c: string, _card: any, { narration }: any) => narrations.push(narration));
		const before = unicorn.hp;

		await card.effect(unicorn, unicorn, ring);

		expect(narrations[0]).to.include('findeth nothing here to purify');
		expect(unicorn.hp).to.equal(before + 5);
	});

	it('wards, then heals, after the cleanse, in that order', async () => {
		unicorn.encounterModifiers.str = -3;
		const card = new HornOfProofCard();
		const order: string[] = [];
		card.on('narration', (_c: string, _card: any, { narration }: any) => {
			if (narration.includes('draweth out the curse')) order.push('cleanse');
			if (narration.includes('sets')) order.push('ward');
		});
		unicorn.on('heal', () => order.push('heal'));
		const before = unicorn.hp;

		await card.effect(unicorn, unicorn, ring);

		expect(order).to.deep.equal(['cleanse', 'ward', 'heal']);
		expect(unicorn.encounterModifiers.str).to.equal(0);
		expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal('armed');
		expect(unicorn.hp).to.equal(before + 5);
	});

	it('tells the player what the ward covers', () => {
		const stats = new HornOfProofCard().stats;
		expect(stats).to.include('ward yourself for one round');
		expect(stats).to.include('a hold, a curse, poison, being blinked away, or being confused');
		expect(stats).to.include('once per fight');
	});

	describe('the ward (roadmap 35 task 5; moved from the Unconquerable Horn)', () => {
		it('quotes Job only for a Unicorn: a ward lent in confusion protects anyone', async () => {
			// The Basilisk carries a ward lent to it; the Unicorn tries to hold it.
			new HornOfProofCard().ward(unicorn, foe);
			const hold = new ImmobilizeCard();
			sinon.stub(hold, 'immobilizeCheck').returns(true);
			const narrations: string[] = [];
			hold.on('narration', (_c: string, _card: any, { narration }: any) => narrations.push(narration));

			await hold.effect(unicorn, foe, ring, contestants);

			expect(isHeld(foe)).to.equal(false);
			expect(narrations.join('\n')).to.include('Tor will not be taken and held.');
			expect(narrations.join('\n')).not.to.include('Will the unicorn');
		});

		it('cancels the next hold an opponent lands, then is spent', async () => {
			await new HornOfProofCard().play(unicorn, foe, ring, contestants);
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
			await new HornOfProofCard().play(unicorn, foe, ring, contestants);
			const hold = new ImmobilizeCard();
			sinon.stub(hold, 'immobilizeCheck').returns(false);

			await hold.effect(foe, unicorn, ring, contestants);

			expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal('armed');
		});

		it('cancels the hold but not the damage that comes with it', async () => {
			await new HornOfProofCard().play(unicorn, foe, ring, contestants);
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
			await new HornOfProofCard().play(unicorn, foe, ring, contestants);
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
			await new HornOfProofCard().play(unicorn, foe, ring, teamed);
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
			const card = new HornOfProofCard();
			const narrations: string[] = [];
			card.on('narration', (_c: string, _card: any, { narration }: any) => narrations.push(narration));

			await card.play(unicorn, foe, ring, contestants);
			await card.play(unicorn, foe, ring, contestants);
			expect(narrations.join('\n')).to.include('hath drunk already, and standeth warded.');

			unicorn.encounterModifiers[CONTROL_WARD] = 'spent';
			await card.play(unicorn, foe, ring, contestants);
			expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal('spent');
			expect(narrations.join('\n')).to.include('already been warded once this fight');
		});

		it('never cancels the Unicorn\'s own Sticketh hold', async () => {
			await new HornOfProofCard().play(unicorn, foe, ring, contestants);

			new StickethCard().stickFast(unicorn, ring);

			expect(isHeld(unicorn)).to.equal(true);
			expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal('armed');
		});

		it('is gone after the encounter ends', async () => {
			await new HornOfProofCard().play(unicorn, foe, ring, contestants);
			unicorn.endEncounter();

			expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal(undefined);
		});

		describe('as a counterspell (roadmap 35)', () => {
			it('cancels a curse, but the hit that carried it still lands', async () => {
				await new HornOfProofCard().effect(unicorn, unicorn);

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
				await new HornOfProofCard().effect(unicorn, unicorn);

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
				await new HornOfProofCard().effect(unicorn, unicorn);

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
				await new HornOfProofCard().effect(unicorn, unicorn);

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
				await new HornOfProofCard().effect(unicorn, unicorn);

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
				await new HornOfProofCard().effect(unicorn, unicorn);

				const beforeHp = unicorn.hp;
				await new SandstormCard().effect(foe, unicorn, ring, contestants);

				expect(unicorn.hp).to.be.below(beforeHp);
				expect(
					unicorn.encounterEffects.some((effect: any) => effect.effectType === SANDSTORM_EFFECT)
				).to.equal(false);
				expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal('spent');
			});

			it("cancels being faceswapped onto a warded attacker; the hit lands on its real target", async () => {
				await new HornOfProofCard().effect(unicorn, unicorn);
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
				await new HornOfProofCard().effect(unicorn, unicorn);
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
				const rearm = new HornOfProofCard();
				rearm.ward(unicorn, unicorn);
				expect(unicorn.encounterModifiers[CONTROL_WARD]).to.equal('lapsed');
			});
		});
	});

	it('hydrates from JSON', () => {
		const restored = hydrateCard(JSON.parse(JSON.stringify(new HornOfProofCard())));
		expect(restored).to.be.instanceOf(HornOfProofCard);
	});
});
