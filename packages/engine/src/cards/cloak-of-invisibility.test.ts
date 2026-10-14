import { expect } from 'chai';

import { ATTACK_PHASE, DEFENSE_PHASE } from '../constants/phases.js';
import Basilisk from '../monsters/basilisk.js';
import { CloakOfInvisibilityCard } from './cloak-of-invisibility.js';
import { TestCard } from './test.js';
import { INVISIBILITY_EFFECT } from '../constants/effect-types.js';
import WeepingAngel from '../monsters/weeping-angel.js';

describe('./cards/cloak-of-invisibility.ts', () => {
	it('can be instantiated with defaults', () => {
		const invisibility = new CloakOfInvisibilityCard();

		expect(invisibility).to.be.an.instanceof(CloakOfInvisibilityCard);
		expect(invisibility.icon).to.equal('☁️');
		expect(invisibility.stats).to.equal(
			'You are invisible until you play a card that targets another player, or for the next 3 cards you play (whichever comes first).\n1d20 + their int vs 10 + your int for an opponent to see you on their turn. On a natural 20 they tear off your cloak of invisibility, and you are seen at once.'
		);
	});

	it('can be drawn', () => {
		const invisibility = new CloakOfInvisibilityCard();

		const monster = new WeepingAngel({ name: 'player', xp: 50 });

		expect((monster as any).canHoldCard(CloakOfInvisibilityCard)).to.equal(true);
		expect((monster as any).canHoldCard(invisibility)).to.equal(true);
	});

	it('can be played', () => {
		const invisibility = new CloakOfInvisibilityCard();

		const player = new WeepingAngel({ name: 'player' });
		const target = new Basilisk({ name: 'target' });

		expect((player as any).encounterEffects.length).to.equal(0);

		return invisibility.play(player, target).then(() => {
			expect((player as any).encounterEffects.length).to.equal(1);
		});
	});

	it('has an effect', () => {
		const invisibility = new CloakOfInvisibilityCard();
		const card = new TestCard();

		const player = new WeepingAngel({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
		};

		(invisibility as any).checkSuccess = () => ({ strokeOfLuck: false, curseOfLoki: false, success: false });

		expect((player as any).encounterEffects.length).to.equal(0);

		return card
			.play(target, player, ring, ring.contestants)
			.then(() => {
				expect((target as any).played).to.equal(1);
				expect((player as any).targeted).to.equal(1);
			})
			.then(() => invisibility.play(player, target, ring, ring.contestants))
			.then(() => (player as any).encounterEffects[0]({ card, phase: ATTACK_PHASE, player: target, target: player }))
			.then((modifiedCard: any) =>
				(player as any).encounterEffects[0]({ card: modifiedCard, phase: DEFENSE_PHASE, player: target, target: player })
			)
			.then((modifiedCard: any) => modifiedCard.play(target, player, ring, ring.contestants))
			.then(() => {
				expect((target as any).played).to.equal(1);
				expect((player as any).targeted).to.equal(1);
				expect((player as any).encounterEffects.length).to.equal(1);
			})
			.then(() => (player as any).encounterEffects[0]({ card, phase: ATTACK_PHASE, player, target }))
			.then((modifiedCard: any) =>
				(player as any).encounterEffects[0]({ card: modifiedCard, phase: DEFENSE_PHASE, player, target })
			)
			.then((modifiedCard: any) => modifiedCard.play(player, player, ring, ring.contestants))
			.then(() => {
				expect((target as any).played).to.equal(1);
				expect((player as any).targeted).to.equal(2);
				expect((player as any).played).to.equal(1);
				expect((player as any).encounterEffects.length).to.equal(1);
			})
			.then(() => (player as any).encounterEffects[0]({ card, phase: ATTACK_PHASE, player, target }))
			.then((modifiedCard: any) =>
				(player as any).encounterEffects[0]({ card: modifiedCard, phase: DEFENSE_PHASE, player, target })
			)
			.then((modifiedCard: any) => modifiedCard.play(player, target, ring, ring.contestants))
			.then(() => {
				expect((target as any).played).to.equal(1);
				expect((player as any).targeted).to.equal(2);
				expect((player as any).played).to.equal(2);
				expect((target as any).targeted).to.equal(1);
				expect((player as any).encounterEffects.length).to.equal(0);
			});
	});
});

describe('finding a hidden monster (owner, 2026-10-14)', () => {
	it('is 1d20 + the finder\'s int against 10 + the hider\'s int for a Cloak', async () => {
		const { CloakOfInvisibilityCard, HIDE_DIFFICULTY } = await import('./cloak-of-invisibility.js');
		const cloak = new CloakOfInvisibilityCard();
		expect(HIDE_DIFFICULTY).to.equal(10);
		expect(cloak.hideDifficulty({ intModifier: 3, dexModifier: -1 })).to.equal(13);
	});

	it('uses dex for the Camouflage Vest: blending in is physical', async () => {
		const { CamouflageVestCard } = await import('./camouflage-vest.js');
		const vest = new CamouflageVestCard();
		expect(vest.hideDifficulty({ intModifier: -1, dexModifier: 2 })).to.equal(12);
		expect(vest.stats).to.include('1d20 + their int vs 10 + your dex');
	});

	it('names both sides of the roll on Mood Scales too', async () => {
		const { MoodScalesCard } = await import('./mood-scales.js');
		expect(new MoodScalesCard().stats).to.include('1d20 + their int vs 10 + your int');
	});

	// Drives the real search, so a regression to the hider's raw int (5 + mod) would fail here.
	for (const [margin, found] of [[1, true], [0, false]] as const) {
		it(`${found ? 'finds' : 'misses'} the hider at 10 + their int mod ${margin ? '+ 1' : '(a tie goes to the hider)'}`, async () => {
			const cloak = new CloakOfInvisibilityCard();
			const hider = new WeepingAngel({ name: 'hider' });
			const finder = new Basilisk({ name: 'finder' });
			const ring: any = { contestants: [{ monster: hider }, { monster: finder }] };
			await cloak.play(hider, hider, ring, ring.contestants);
			const result = cloak.hideDifficulty(hider) + margin;
			(cloak as any).getSavingThrow = () => ({
				primaryDice: '1d20', result, naturalRoll: { rolled: [10], result: 10 }, bonusResult: 0, modifier: 0,
				strokeOfLuck: false, curseOfLoki: false,
			});

			await new TestCard().play(finder, hider, ring, ring.contestants);

			expect((hider as any).targeted ?? 0).to.equal(found ? 1 : 0);
		});
	}

	// Owner, 2026-10-14: three cards, up from two.
	it('keeps the hider unseen for its next three cards, and reveals it on the fourth', async () => {
		const cloak = new CloakOfInvisibilityCard();
		const hider = new WeepingAngel({ name: 'hider' });
		const ring: any = { contestants: [{ monster: hider }] };
		await cloak.play(hider, hider, ring, ring.contestants);
		const playOwnCard = () => new TestCard().play(hider, hider, ring, ring.contestants);
		const hidden = () => (hider as any).encounterEffects.some((e: any) => e.effectType === INVISIBILITY_EFFECT);

		for (let i = 0; i < 3; i += 1) {
			await playOwnCard();
			expect(hidden(), `after card ${i + 1}`).to.equal(true);
		}
		await playOwnCard();
		expect(hidden()).to.equal(false);
	});

	it('is torn off at once by a natural 20, and the line says so', async () => {
		const cloak = new CloakOfInvisibilityCard();
		const hider = new WeepingAngel({ name: 'hider' });
		const finder = new Basilisk({ name: 'finder' });
		const ring: any = { contestants: [{ monster: hider }, { monster: finder }] };
		await cloak.play(hider, hider, ring, ring.contestants);
		(cloak as any).getSavingThrow = () => ({
			primaryDice: '1d20', result: 20, naturalRoll: { rolled: [20], result: 20 }, bonusResult: 0, modifier: 0,
			strokeOfLuck: true, curseOfLoki: false,
		});
		const outcomes: string[] = [];
		cloak.on('rolled', (_c: unknown, _card: unknown, { outcome }: any) => outcomes.push(outcome));

		await new TestCard().play(finder, hider, ring, ring.contestants);

		expect((hider as any).encounterEffects).to.have.length(0);
		expect((hider as any).targeted).to.equal(1);
		expect(outcomes[0]).to.contain(`tear`).and.to.contain('off');
		expect(outcomes[0]).to.contain('cloak of invisibility');
		expect(outcomes[0]).to.contain('hidden no longer');
	});
});
