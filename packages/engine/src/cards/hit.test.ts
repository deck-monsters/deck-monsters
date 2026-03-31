import { expect } from 'chai';
import sinon from 'sinon';

import { ABUNDANT } from '../helpers/probabilities.js';
import { ALMOST_NOTHING } from '../helpers/costs.js';
import { HitCard } from './hit.js';
import Basilisk from '../monsters/basilisk.js';

describe('./cards/hit.ts', () => {
	let hit: HitCard;
	let hitEffectSpy: sinon.SinonSpy;
	let hitCheckStub: sinon.SinonStub;
	let player: any;
	let target: any;
	let ring: any;

	before(() => {
		hit = new HitCard();
		hitEffectSpy = sinon.spy(hit, 'effect');
		hitCheckStub = sinon.stub(hit, 'hitCheck');
	});

	beforeEach(() => {
		player = new Basilisk({ name: 'player' });
		target = new Basilisk({ name: 'target' });
		ring = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		hitCheckStub.returns({
			attackRoll: hit.getAttackRoll(player),
			success: true,
			strokeOfLuck: false,
			curseOfLoki: false,
		});
	});

	afterEach(() => {
		hitEffectSpy.resetHistory();
	});

	after(() => {
		hitEffectSpy.restore();
		hitCheckStub.restore();
	});

	it('can be instantiated with defaults', () => {
		expect(hit).to.be.an.instanceof(HitCard);
		expect(hit.stats).to.equal('Hit: 1d20 vs ac / Damage: 1d6');
		expect((HitCard as any).probability).to.equal(ABUNDANT.probability + 10);
		expect((HitCard as any).cost).to.equal(ALMOST_NOTHING.cost);
		expect(hit.attackDice).to.equal('1d20');
		expect(hit.damageDice).to.equal('1d6');
		expect(hit.targetProp).to.equal('ac');
		expect(hit.icon).to.equal('👊');
	});

	it('can be instantiated with options', () => {
		const customHit = new HitCard({ damageDice: '2d6', attackDice: '2d20', targetProp: 'int', icon: '😝' });

		expect(customHit).to.be.an.instanceof(HitCard);
		expect((HitCard as any).probability).to.equal(ABUNDANT.probability + 10);
		expect((HitCard as any).cost).to.equal(ALMOST_NOTHING.cost);
		expect(customHit.attackDice).to.equal('2d20');
		expect(customHit.damageDice).to.equal('2d6');
		expect(customHit.targetProp).to.equal('int');
		expect(customHit.icon).to.equal('😝');
		expect(customHit.stats).to.equal('Hit: 2d20 vs int / Damage: 2d6');
	});

	it('can be played', () => {
		const before = target.hp;

		return hit.play(player, target, ring).then(() => {
			expect(target.hp).to.be.below(before);
			expect(hitEffectSpy.callCount).to.equal(1);
			expect(hitCheckStub.callCount).to.equal(1);
		});
	});
});
