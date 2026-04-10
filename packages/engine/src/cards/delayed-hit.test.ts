import { expect } from 'chai';
import sinon from 'sinon';

import { UNCOMMON } from '../helpers/probabilities.js';
import { REASONABLE } from '../helpers/costs.js';
import { DEFENSE_PHASE } from '../constants/phases.js';
import { DelayedHit } from './delayed-hit.js';
import { HitCard } from './hit.js';
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
});
