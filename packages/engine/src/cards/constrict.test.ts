import { expect } from 'chai';
import sinon from 'sinon';

import { HitCard } from './hit.js';
import Basilisk from '../monsters/basilisk.js';
import Minotaur from '../monsters/minotaur.js';
import { ConstrictCard } from './constrict.js';
import { GLADIATOR, MINOTAUR, BASILISK, JINN } from '../constants/creature-types.js';

describe('./cards/constrict.ts', () => {
	it('can be instantiated with defaults', () => {
		const constrict = new ConstrictCard();
		const hit = new HitCard({ targetProp: (constrict as any).targetProp });

		const stats = `Immobilize and hit your opponent by coiling your serpentine body around them and squeezing. If opponent is immune, hit instead.

If already immobilized, hit instead.
${hit.stats}
 +3 advantage vs Gladiator, Minotaur
 -3 disadvantage vs Basilisk, Jinn

Opponent breaks free by rolling 1d20 vs immobilizer's dex +/- advantage/disadvantage - (turns immobilized * 3)
Hits immobilizer back on stroke of luck.
Turns immobilized resets on curse of loki.

-2 hp each turn immobilized.`;

		expect(constrict).to.be.an.instanceof(ConstrictCard);
		expect((constrict as any).freedomThresholdModifier).to.equal(3);
		expect((constrict as any).freedomSavingThrowTargetAttr).to.equal('dex');
		expect((constrict as any).targetProp).to.equal('dex');
		expect((constrict as any).doDamageOnImmobilize).to.be.true;
		expect((constrict as any).ongoingDamage).to.equal(2);
		expect(constrict.stats).to.equal(stats);
		expect((constrict as any).strongAgainstCreatureTypes).to.deep.equal([GLADIATOR, MINOTAUR]);
		expect((constrict as any).weakAgainstCreatureTypes).to.deep.equal([BASILISK, JINN]);
		expect((constrict as any).uselessAgainstCreatureTypes).to.deep.equal([]);
		expect((constrict as any).permittedClassesAndTypes).to.deep.equal([BASILISK]);
	});

	it('can be instantiated with options', () => {
		const constrict = new ConstrictCard({ freedomThresholdModifier: 2, doDamageOnImmobilize: false, ongoingDamage: 3 } as any);

		expect(constrict).to.be.an.instanceof(ConstrictCard);
		expect((constrict as any).freedomThresholdModifier).to.equal(2);
		expect((constrict as any).doDamageOnImmobilize).to.be.false;
		expect((constrict as any).ongoingDamage).to.equal(3);
	});

	it('do damage on immobilize', () => {
		const constrict = new ConstrictCard();
		const checkSuccessStub = sinon.stub(
			Object.getPrototypeOf(Object.getPrototypeOf(constrict)),
			'checkSuccess'
		);
		const hitCheckStub = sinon.stub(
			Object.getPrototypeOf(Object.getPrototypeOf(constrict)),
			'hitCheck'
		);

		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const before = (target as any).hp;

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		const attackRoll = (constrict as any).getAttackRoll(player, target);
		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });
		hitCheckStub.returns({ attackRoll, success: true, strokeOfLuck: false, curseOfLoki: false });

		return constrict.play(player, target, ring, ring.contestants).then(() => {
			checkSuccessStub.restore();
			hitCheckStub.restore();

			expect((target as any).hp).to.be.below(before);
			expect((target as any).encounterEffects.length).to.equal(1);
		});
	});
});
