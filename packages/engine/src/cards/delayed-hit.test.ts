import { expect } from 'chai';
import sinon from 'sinon';

import { UNCOMMON } from '../helpers/probabilities.js';
import { REASONABLE } from '../helpers/costs.js';
import { DEFENSE_PHASE } from '../constants/phases.js';
import { DelayedHit } from './delayed-hit.js';
import { HitCard } from './hit.js';
import { HealCard } from './heal.js';
import Basilisk from '../monsters/basilisk.js';

describe('./cards/delayed-hit.ts', () => {
	let hit: HitCard;
	let delayedHit: DelayedHit;
	let hitCheckStub: sinon.SinonStub;
	let delayedHitHitCheckStub: sinon.SinonStub;
	let player: any;
	let target: any;
	let ring: any;

	before(() => {
		hit = new HitCard();
		delayedHit = new DelayedHit();
		hitCheckStub = sinon.stub(hit, 'hitCheck');
		delayedHitHitCheckStub = sinon.stub(Object.getPrototypeOf(delayedHit), 'hitCheck');
	});

	beforeEach(() => {
		player = new Basilisk({ name: 'player' });
		target = new Basilisk({ name: 'target' });
		ring = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
			encounterEffects: [],
		};

		const successfulHit = {
			attackRoll: hit.getAttackRoll(player),
			success: true,
			strokeOfLuck: false,
			curseOfLoki: false,
		};
		hitCheckStub.returns(successfulHit);
		delayedHitHitCheckStub.returns(successfulHit);
	});

	afterEach(() => {
		hitCheckStub.resetHistory();
		delayedHitHitCheckStub.resetHistory();
	});

	after(() => {
		hitCheckStub.restore();
		delayedHitHitCheckStub.restore();
	});

	it('can be instantiated with defaults', () => {
		expect(delayedHit).to.be.an.instanceof(DelayedHit);
		expect((delayedHit as any).probability).to.equal(UNCOMMON.probability);
		expect((delayedHit as any).cost).to.equal(REASONABLE.cost);
		expect((delayedHit as any).attackDice).to.equal('1d20');
		expect((delayedHit as any).damageDice).to.equal('1d6');
		expect((delayedHit as any).targetProp).to.equal('ac');
		expect(delayedHit.icon).to.equal('🤛');
		expect(delayedHit.stats).to.equal(`Delay your turn. Use the delayed turn to immediately hit the next player who hits you.
${hit.stats}`);
	});

	it('can be instantiated with options', () => {
		const customDelayedHit = new DelayedHit({ damageDice: '2d6', attackDice: '2d20', targetProp: 'int', icon: '😝' });
		const customHit = new HitCard({ damageDice: '2d6', attackDice: '2d20', targetProp: 'int', icon: '😝' });

		expect(customDelayedHit).to.be.an.instanceof(DelayedHit);
		expect((customDelayedHit as any).probability).to.equal(UNCOMMON.probability);
		expect((customDelayedHit as any).cost).to.equal(REASONABLE.cost);
		expect((customDelayedHit as any).attackDice).to.equal('2d20');
		expect((customDelayedHit as any).damageDice).to.equal('2d6');
		expect((customDelayedHit as any).targetProp).to.equal('int');
		expect(customDelayedHit.icon).to.equal('😝');
		expect(customDelayedHit.stats).to.equal(`Delay your turn. Use the delayed turn to immediately hit the next player who hits you.
${customHit.stats}`);
	});

	it('can be played and is stack-able', () => {
		const previousTargetHP = target.hp;
		const previousPlayerHP = player.hp;

		expect(ring.encounterEffects.length).to.equal(0);

		return delayedHit
			.play(player, target, ring)
			.then(() => expect(ring.encounterEffects.length).to.equal(1))
			.then(() => new Promise<void>(resolve => setTimeout(resolve, 10)))
			.then(() => {
				expect(target.hp).to.equal(previousTargetHP);
				expect(player.hp).to.equal(previousPlayerHP);
				expect(hitCheckStub.called).to.be.false;
			})
			.then(() => delayedHit.play(player, target, ring))
			.then(() => expect(ring.encounterEffects.length).to.equal(2))
			.then(() => new Promise<void>(resolve => setTimeout(resolve, 10)))
			.then(() => {
				expect(target.hp).to.equal(previousTargetHP);
				expect(player.hp).to.equal(previousPlayerHP);
				expect(hitCheckStub.called).to.be.false;
			})
			.then(() => ring.encounterEffects[0]({ phase: DEFENSE_PHASE, ring, card: hit }))
			.then(() => ring.encounterEffects[1]({ phase: DEFENSE_PHASE, ring, card: hit }))
			.then(() => hit.play(target, player, ring))
			.then(() => expect(ring.encounterEffects.length).to.equal(0))
			.then(() => {
				expect(target.hp).to.be.below(previousTargetHP);
				expect(player.hp).to.be.below(previousPlayerHP);
				expect(delayedHitHitCheckStub.callCount).to.equal(2);
				expect(hitCheckStub.callCount).to.equal(1);
			});
	});

	/**
	 * A delayed hit lands out of turn, several turns after it was played. Reported as
	 * confusing when it triggers: nothing in the feed tied the counter-attack back to the
	 * card that set it up. See 10b-bugs-fixed.md #130.
	 */
	describe('reading a delayed hit in the feed', () => {
		it('marks the setup line with the card icon, like the payoff lines', () => {
			const narrations: string[] = [];
			const card = new DelayedHit();
			card.on('narration', (_klass: unknown, _card: unknown, { narration }: { narration: string }) =>
				narrations.push(narration));

			const player = {
				givenName: 'Stonefang',
				pronouns: { he: 'he', him: 'him', his: 'his' },
				encounterModifiers: {},
			};
			card.effect(player as never, player as never, { encounterEffects: [] } as never);

			expect(narrations[0]).to.contain(card.icon);
		});

		/**
		 * The reported confusion, precisely: you play the card and see it in the feed like
		 * any other, and then turns later the effect fires in the middle of someone else's
		 * attack. Without the card named at that moment, "responds to the blow" reads as a
		 * spontaneous reaction and the feed never answers why it happened.
		 */
		it('names the card at the moment it fires, not just when it is played', () => {
			const narrations: string[] = [];
			const payloads: Array<Record<string, unknown>> = [];
			const onNarration = (
				_klass: unknown,
				_card: unknown,
				payload: { narration: string; owner?: unknown },
			) => {
				narrations.push(payload.narration);
				payloads.push(payload);
			};
			delayedHit.on('narration', onNarration);

			return delayedHit
				.play(player, player, ring)
				.then(() => ring.encounterEffects[0]({ phase: DEFENSE_PHASE, ring, card: hit }))
				// `target` strikes `player`, which is what springs the delayed hit.
				.then(() => hit.play(target, player, ring))
				.then(() => {
					const trigger = narrations.find(line => line.includes('finds its moment'));
					expect(trigger, 'expected a trigger narration').to.not.equal(undefined);
					expect(trigger).to.contain(delayedHit.cardType);
					expect(trigger).to.contain(target.givenName);
					const triggerPayload = payloads.find(payload =>
						String(payload.narration).includes('finds its moment'));
					expect(triggerPayload?.owner).to.equal(player);
				})
				.finally(() => delayedHit.off('narration', onNarration));
		});

		/**
		 * Reported as delayed hits "playing at odd times": a payoff line landing right after
		 * an unrelated card (a Heal, in the live capture) with "responds to the blow X gave
		 * him" when X had just healed, not struck. See 10b-bugs-fixed.md #155.
		 *
		 * The blow was real, just earlier: it was another Delayed Hit's counter-attack. The
		 * wrappers nest in arming order, so the earlier-armed card's check runs before the
		 * later-armed card's counter lands. That hit then sat unanswered until the next card
		 * anyone played.
		 */
		it('answers a blow dealt by another delayed hit in the same play, not after the next unrelated card', async () => {
			const targetsDelayedHit = new DelayedHit();
			const playersDelayedHit = new DelayedHit();
			const strike = new HitCard();
			const heal = new HealCard();
			sinon.stub(strike, 'hitCheck').returns({
				attackRoll: strike.getAttackRoll(target),
				success: true,
				strokeOfLuck: false,
				curseOfLoki: false,
			});
			const narrations: string[] = [];
			const onNarration = (_klass: unknown, _card: unknown, { narration }: { narration: string }) =>
				narrations.push(narration);
			targetsDelayedHit.on('narration', onNarration);

			try {
				// `target` arms first, `player` second — the order that leaves a blow unanswered.
				await targetsDelayedHit.play(target, target, ring);
				await playersDelayedHit.play(player, player, ring);
				expect(ring.encounterEffects.length).to.equal(2);

				// `target` strikes `player` through the real card-play path, so both wrappers
				// apply. `player`'s delayed hit answers the blow; that counter is itself the
				// blow `target`'s delayed hit has been waiting for, and must be answered now.
				await strike.play(target, player, ring);
				expect(ring.encounterEffects.length, 'both delayed hits should be spent').to.equal(0);
				expect(delayedHitHitCheckStub.callCount).to.equal(2);
				expect(narrations.filter(line => line.includes('finds its moment'))).to.have.length(1);

				// A later, harmless card must not spring anything.
				narrations.length = 0;
				await heal.play(target, target, ring);
				expect(narrations.filter(line => line.includes('finds its moment'))).to.have.length(0);
			} finally {
				targetsDelayedHit.off('narration', onNarration);
			}
		});

		it('does not open a narration with a blank line', () => {
			// It was the only card in the directory that did, which showed up as stray
			// vertical space in the feed.
			const narrations: string[] = [];
			const card = new DelayedHit();
			card.on('narration', (_klass: unknown, _card: unknown, { narration }: { narration: string }) =>
				narrations.push(narration));

			const player = {
				givenName: 'Stonefang',
				pronouns: { he: 'he', him: 'him', his: 'his' },
				encounterModifiers: {},
			};
			card.effect(player as never, player as never, { encounterEffects: [] } as never);

			for (const narration of narrations) {
				expect(narration.startsWith('\n')).to.equal(false);
			}
		});
	});
});
