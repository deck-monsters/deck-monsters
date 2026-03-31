import { expect } from 'chai';
import sinon from 'sinon';

import { HitCard } from './hit.js';
import Basilisk from '../monsters/basilisk.js';
import Minotaur from '../monsters/minotaur.js';
import { ForkedMetalRodCard } from './forked-metal-rod.js';
import { FIGHTER, BARBARIAN } from '../constants/creature-classes.js';
import { GLADIATOR, MINOTAUR, BASILISK, JINN, WEEPING_ANGEL } from '../constants/creature-types.js';

describe('./cards/forked-metal-rod.ts', () => {
	it('can be instantiated with defaults', () => {
		const forkedMetalRod = new ForkedMetalRodCard();
		const hit = new HitCard({ targetProp: (forkedMetalRod as any).targetProp });

		const stats = `Attack twice (once with each prong). +2 to hit and immobilize for each successfull prong hit.

Chance to immobilize: 1d20 vs str.

If already immobilized, hit instead.
${hit.stats}
 +5 advantage vs Gladiator, Basilisk
 +1 advantage vs Jinn, Minotaur
inneffective against Weeping Angel

Opponent breaks free by rolling 1d20 vs immobilizer's str + advantage - (turns immobilized * 3)
Hits immobilizer back on stroke of luck.
Turns immobilized resets on curse of loki.
`;

		const description = 'A dangerously sharp forked metal rod fashioned for Gladiator and Basilisk-hunting.';

		expect(forkedMetalRod).to.be.an.instanceof(ForkedMetalRodCard);
		expect((ForkedMetalRodCard as any).description).to.equal(description);
		expect((forkedMetalRod as any).freedomThresholdModifier).to.equal(3);
		expect((forkedMetalRod as any).freedomSavingThrowTargetAttr).to.equal('str');
		expect((forkedMetalRod as any).targetProp).to.equal('ac');
		expect((forkedMetalRod as any).doDamageOnImmobilize).to.be.false;
		expect((forkedMetalRod as any).damageDice).to.equal('1d6');
		expect(forkedMetalRod.stats).to.equal(stats);
		expect((forkedMetalRod as any).strongAgainstCreatureTypes).to.deep.equal([GLADIATOR, BASILISK]);
		expect((forkedMetalRod as any).weakAgainstCreatureTypes).to.deep.equal([JINN, MINOTAUR]);
		expect((forkedMetalRod as any).permittedClassesAndTypes).to.deep.equal([FIGHTER, BARBARIAN]);
		expect((forkedMetalRod as any).uselessAgainstCreatureTypes).to.deep.equal([WEEPING_ANGEL]);
	});

	it('can be instantiated with options', () => {
		const forkedMetalRod = new ForkedMetalRodCard({ freedomThresholdModifier: 2, doDamageOnImmobilize: true } as any);

		expect(forkedMetalRod).to.be.an.instanceof(ForkedMetalRodCard);
		expect((forkedMetalRod as any).freedomThresholdModifier).to.equal(2);
		expect((forkedMetalRod as any).doDamageOnImmobilize).to.be.true;
	});

	it('can hit twice and immobilize', () => {
		const forkedMetalRod = new ForkedMetalRodCard();
		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const before = (target as any).hp;

		const forkedMetalRodProto = Object.getPrototypeOf(forkedMetalRod);
		const hornGoreProto = Object.getPrototypeOf(forkedMetalRodProto);
		const immobilizeProto = Object.getPrototypeOf(hornGoreProto);
		const hitProto = Object.getPrototypeOf(immobilizeProto);
		const baseProto = Object.getPrototypeOf(hitProto);
		const basiliskProto = Object.getPrototypeOf(target);
		const creatureProto = Object.getPrototypeOf(basiliskProto);

		const checkSuccessStub = sinon.stub(baseProto, 'checkSuccess');
		const hitCheckStub = sinon.stub(forkedMetalRodProto, 'hitCheck');
		const hitStub = sinon.spy(creatureProto, 'hit');

		const ring: any = {
			contestants: [{ monster: player }, { monster: target }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		const attackRoll = (forkedMetalRod as any).getAttackRoll(player, target);
		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });
		hitCheckStub.returns({ attackRoll, success: true, strokeOfLuck: false, curseOfLoki: false });

		return forkedMetalRod.play(player, target, ring, ring.contestants).then(() => {
			checkSuccessStub.restore();
			hitCheckStub.restore();
			hitStub.restore();

			expect(hitCheckStub.callCount).to.equal(2);
			expect(hitStub.callCount).to.equal(2);
			expect((forkedMetalRod as any).new.freedomThresholdModifier).to.equal(7);
			expect((forkedMetalRod as any).new.dexModifier).to.equal(7);
			expect((target as any).hp).to.be.below(before);
			expect((target as any).encounterEffects.length).to.equal(1);
		});
	});
});
