import { expect } from 'chai';
import sinon from 'sinon';

import { BASILISK, GLADIATOR, JINN, MINOTAUR, WEEPING_ANGEL } from '../constants/creature-types.js';
import { HornGore } from './horn-gore.js';
import Basilisk from '../monsters/basilisk.js';
import Gladiator from '../monsters/gladiator.js';
import Jinn from '../monsters/jinn.js';
import Minotaur from '../monsters/minotaur.js';
import WeepingAngel from '../monsters/weeping-angel.js';

describe('./cards/horn-gore.ts', () => {
	let hornGore: HornGore;
	let angel: any;
	let basilisk: any;
	let gladiator: any;
	let jinn: any;
	let minotaur: any;
	let player: any;

	let hornGoreProto: any;
	let immobilizeProto: any;
	let hitProto: any;
	let baseProto: any;
	let basiliskProto: any;
	let creatureProto: any;

	let checkSuccessStub: sinon.SinonStub;
	let hitCheckStub: sinon.SinonStub;
	let hitStub: sinon.SinonSpy;

	let ring: any;
	let attackRoll: any;

	before(() => {
		hornGore = new HornGore();
		basilisk = new Basilisk();

		hornGoreProto = Object.getPrototypeOf(hornGore);
		immobilizeProto = Object.getPrototypeOf(hornGoreProto);
		hitProto = Object.getPrototypeOf(immobilizeProto);
		baseProto = Object.getPrototypeOf(hitProto);
		basiliskProto = Object.getPrototypeOf(basilisk);
		creatureProto = Object.getPrototypeOf(basiliskProto);

		checkSuccessStub = sinon.stub(baseProto, 'checkSuccess');
		hitCheckStub = sinon.stub(hornGoreProto, 'hitCheck');
		hitStub = sinon.spy(creatureProto, 'hit');
	});

	beforeEach(() => {
		hornGore = new HornGore();
		angel = new WeepingAngel();
		basilisk = new Basilisk();
		gladiator = new Gladiator();
		jinn = new Jinn();
		minotaur = new Minotaur();
		player = new Minotaur({ dexVariance: 0 });

		ring = {
			contestants: [
				{ monster: player },
				{ monster: angel },
				{ monster: basilisk },
				{ monster: minotaur },
				{ monster: gladiator },
				{ monster: jinn },
			],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		attackRoll = hornGore.getAttackRoll(player, basilisk);

		hitCheckStub.returns({ attackRoll, success: true, strokeOfLuck: false, curseOfLoki: false });
		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });
	});

	afterEach(() => {
		checkSuccessStub.resetHistory();
		hitCheckStub.resetHistory();
		hitStub.resetHistory();
	});

	after(() => {
		checkSuccessStub.restore();
		hitCheckStub.restore();
		hitStub.restore();
	});

	it('can be instantiated with defaults', () => {
		expect(hornGore).to.be.an.instanceof(HornGore);
		expect((hornGore as any).freedomSavingThrowTargetAttr).to.equal('str');
		expect((hornGore as any).targetProp).to.equal('ac');
		expect((hornGore as any).freedomThresholdModifier).to.equal(-4);
		expect((hornGore as any).strongAgainstCreatureTypes).to.deep.equal([MINOTAUR, GLADIATOR]);
		expect((hornGore as any).weakAgainstCreatureTypes).to.deep.equal([BASILISK, JINN, WEEPING_ANGEL]);
		expect((hornGore as any).permittedClassesAndTypes).to.deep.equal([MINOTAUR]);
		expect((hornGore as any).doDamageOnImmobilize).to.be.false;
		expect((hornGore as any).damageDice).to.equal('1d4');
	});

	it('only uses half of their damage modifier when calculating damage for a horn', () => {
		const damageRoll = hornGore.getDamageRoll(player);

		expect(damageRoll.modifier).to.deep.equal(1);
	});

	it('calculates attackModifier correctly', () => {
		expect((hornGore as any).getAttackModifier(angel)).to.equal(-6);
		expect((hornGore as any).getAttackModifier(basilisk)).to.equal(-6);
		expect((hornGore as any).getAttackModifier(gladiator)).to.equal(-2);
		expect((hornGore as any).getAttackModifier(jinn)).to.equal(-6);
		expect((hornGore as any).getAttackModifier(minotaur)).to.equal(-2);
	});

	it('calculates freedom threshold correctly', () => {
		expect((hornGore as any).getFreedomThreshold(player, angel)).to.equal(1);
		expect((hornGore as any).getFreedomThreshold(player, basilisk)).to.equal(1);
		expect((hornGore as any).getFreedomThreshold(player, gladiator)).to.equal((player as any).str - 2);
		expect((hornGore as any).getFreedomThreshold(player, jinn)).to.equal(1);
		expect((hornGore as any).getFreedomThreshold(player, minotaur)).to.equal((player as any).str - 2);

		angel.encounterModifiers.immobilizedTurns = 1;
		basilisk.encounterModifiers.immobilizedTurns = 1;
		minotaur.encounterModifiers.immobilizedTurns = 1;
		gladiator.encounterModifiers.immobilizedTurns = 1;
		jinn.encounterModifiers.immobilizedTurns = 1;

		expect((hornGore as any).getFreedomThreshold(player, angel)).to.equal(1);
		expect((hornGore as any).getFreedomThreshold(player, basilisk)).to.equal(1);
		expect((hornGore as any).getFreedomThreshold(player, gladiator)).to.equal((player as any).str - 2 - 3);
		expect((hornGore as any).getFreedomThreshold(player, jinn)).to.equal(1);
		expect((hornGore as any).getFreedomThreshold(player, minotaur)).to.equal((player as any).str - 2 - 3);
	});

	it('hits twice and immobilizes', () => {
		const before = basilisk.hp;

		return hornGore.play(player, basilisk, ring, ring.contestants).then(() => {
			expect(hitCheckStub.callCount).to.equal(2);
			expect(hitStub.callCount).to.equal(2);
			expect((hornGore as any).new.freedomThresholdModifier).to.equal(0);
			expect((hornGore as any).new.dexModifier).to.equal(4);
			expect(basilisk.hp).to.be.below(before);
			expect(basilisk.encounterEffects.length).to.equal(1);
		});
	});

	it('tries to immobilize even if only hits once', () => {
		hitCheckStub.onFirstCall().returns({ attackRoll, success: true, strokeOfLuck: false, curseOfLoki: false });
		hitCheckStub.onSecondCall().returns({ attackRoll, success: false, strokeOfLuck: false, curseOfLoki: false });

		const goreSpy = sinon.spy(hornGoreProto, 'gore');
		const before = basilisk.hp;

		return hornGore.play(player, basilisk, ring, ring.contestants).then(() => {
			expect(hitCheckStub.callCount).to.equal(2);
			expect(goreSpy.callCount).to.equal(2);
			expect(hitStub.callCount).to.equal(1);
			expect((hornGore as any).new.freedomThresholdModifier).to.equal(-2);
			expect((hornGore as any).new.dexModifier).to.equal(2);
			expect(basilisk.hp).to.be.below(before);
			expect(basilisk.encounterEffects.length).to.equal(1);
			goreSpy.restore();
		});
	});

	it('does not immobilize if basilisk is dead', () => {
		basilisk.hp = 1;
		attackRoll = { primaryDice: '1d20', result: 19, naturalRoll: { rolled: [19], result: 19 }, bonusResult: 0, modifier: 0 };

		return hornGore.play(player, basilisk, ring, ring.contestants).then(() => {
			expect(basilisk.hp).to.be.below(0);
			expect(basilisk.encounterEffects.length).to.equal(0);
		});
	});

	it('handles all-miss outcomes consistently', () => {
		checkSuccessStub.returns({ success: false, strokeOfLuck: false, curseOfLoki: false });
		hitCheckStub.returns({ attackRoll, success: false, strokeOfLuck: false, curseOfLoki: false });

		return hornGore.play(player, basilisk, ring, ring.contestants).then(() => {
			expect(hitCheckStub.callCount).to.equal(2);
			expect((hornGore as any).new.freedomThresholdModifier).to.equal(-2);
			expect((hornGore as any).new.dexModifier).to.equal(2);
		});
	});
});
