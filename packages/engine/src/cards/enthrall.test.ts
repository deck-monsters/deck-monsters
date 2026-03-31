import { expect } from 'chai';
import sinon from 'sinon';

import { EnthrallCard } from './enthrall.js';
import { HitCard } from './hit.js';
import Basilisk from '../monsters/basilisk.js';
import Gladiator from '../monsters/gladiator.js';
import Jinn from '../monsters/jinn.js';
import Minotaur from '../monsters/minotaur.js';
import WeepingAngel from '../monsters/weeping-angel.js';
import { BASILISK, GLADIATOR, JINN, MINOTAUR, WEEPING_ANGEL } from '../constants/creature-types.js';

describe('./cards/enthrall.ts', () => {
	let angel: any;
	let basilisk: any;
	let gladiator: any;
	let jinn: any;
	let minotaur: any;
	let player: any;
	let ring: any;
	let enthrall: EnthrallCard;
	let enthrallProto: any;
	let immobilizeProto: any;
	let hitProto: any;
	let baseProto: any;
	let checkSuccessStub: sinon.SinonStub;

	beforeEach(() => {
		angel = new WeepingAngel();
		basilisk = new Basilisk();
		gladiator = new Gladiator();
		jinn = new Jinn();
		minotaur = new Minotaur();
		player = new WeepingAngel({ intVariance: 0 });

		ring = {
			contestants: [
				{ character: {}, monster: player },
				{ character: {}, monster: angel },
				{ character: {}, monster: basilisk },
				{ character: {}, monster: minotaur },
				{ character: {}, monster: gladiator },
				{ character: {}, monster: jinn },
			],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		enthrall = new EnthrallCard();
		enthrallProto = Object.getPrototypeOf(enthrall);
		immobilizeProto = Object.getPrototypeOf(enthrallProto);
		hitProto = Object.getPrototypeOf(immobilizeProto);
		baseProto = Object.getPrototypeOf(hitProto);
		checkSuccessStub = sinon.stub(baseProto, 'checkSuccess');
		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });
	});

	afterEach(() => {
		checkSuccessStub.restore();
	});

	it('can be instantiated with defaults', () => {
		const hit = new HitCard({ targetProp: (enthrall as any).targetProp });

		const stats = `Immobilize all opponents.

If already immobilized, hit instead.
${hit.stats}
 +2 advantage vs Basilisk, Gladiator
 -2 disadvantage vs Minotaur, Weeping Angel
ineffective against Jinn

Opponent breaks free by rolling 1d20 vs immobilizer's int +/- advantage/disadvantage - (turns immobilized * 3)
Hits immobilizer back on stroke of luck.
Turns immobilized resets on curse of loki.
`;

		expect(enthrall).to.be.an.instanceof(EnthrallCard);
		expect((enthrall as any).freedomThresholdModifier).to.equal(2);
		expect((enthrall as any).freedomSavingThrowTargetAttr).to.equal('int');
		expect((enthrall as any).targetProp).to.equal('int');
		expect((enthrall as any).doDamageOnImmobilize).to.be.false;
		expect(enthrall.stats).to.equal(stats);
		expect((enthrall as any).strongAgainstCreatureTypes).to.deep.equal([BASILISK, GLADIATOR]);
		expect((enthrall as any).weakAgainstCreatureTypes).to.deep.equal([MINOTAUR, WEEPING_ANGEL]);
		expect((enthrall as any).permittedClassesAndTypes).to.deep.equal([WEEPING_ANGEL]);
		expect((enthrall as any).uselessAgainstCreatureTypes).to.deep.equal([JINN]);
	});

	it('can be instantiated with options', () => {
		const customEnthrall = new EnthrallCard({ freedomThresholdModifier: 2, doDamageOnImmobilize: true } as any);

		expect(customEnthrall).to.be.an.instanceof(EnthrallCard);
		expect((customEnthrall as any).freedomThresholdModifier).to.equal(2);
		expect((customEnthrall as any).doDamageOnImmobilize).to.be.true;
	});

	it('calculates attackModifier correctly', () => {
		expect((enthrall as any).getAttackModifier(angel)).to.equal(-2);
		expect((enthrall as any).getAttackModifier(basilisk)).to.equal(2);
		expect((enthrall as any).getAttackModifier(gladiator)).to.equal(2);
		expect((enthrall as any).getAttackModifier(jinn)).to.equal(0);
		expect((enthrall as any).getAttackModifier(minotaur)).to.equal(-2);
	});

	it('calculates freedom threshold correctly', () => {
		expect((enthrall as any).getFreedomThreshold(player, angel)).to.equal(5);
		expect((enthrall as any).getFreedomThreshold(player, basilisk)).to.equal(9);
		expect((enthrall as any).getFreedomThreshold(player, gladiator)).to.equal(9);
		expect((enthrall as any).getFreedomThreshold(player, jinn)).to.equal(7);
		expect((enthrall as any).getFreedomThreshold(player, minotaur)).to.equal(5);

		angel.encounterModifiers.immobilizedTurns = 2;
		basilisk.encounterModifiers.immobilizedTurns = 2;
		minotaur.encounterModifiers.immobilizedTurns = 2;
		gladiator.encounterModifiers.immobilizedTurns = 2;
		jinn.encounterModifiers.immobilizedTurns = 2;

		expect((enthrall as any).getFreedomThreshold(player, angel)).to.equal(1);
		expect((enthrall as any).getFreedomThreshold(player, basilisk)).to.equal(3);
		expect((enthrall as any).getFreedomThreshold(player, gladiator)).to.equal(3);
		expect((enthrall as any).getFreedomThreshold(player, jinn)).to.equal(1);
		expect((enthrall as any).getFreedomThreshold(player, minotaur)).to.equal(1);
	});

	it('immobilizes others on play', () =>
		enthrall.play(player, basilisk, ring, ring.contestants).then(() => {
			expect(player.encounterEffects.length).to.equal(0);
			expect(angel.encounterEffects.length).to.equal(1);
			expect(basilisk.encounterEffects.length).to.equal(1);
			expect(gladiator.encounterEffects.length).to.equal(1);
			expect(jinn.encounterEffects.length).to.equal(0);
			expect(minotaur.encounterEffects.length).to.equal(1);
		}));

	it('hits immune players on play', () => {
		const jinnBeforeHP = jinn.hp;

		return enthrall.play(player, jinn, ring, ring.contestants).then(() => {
			expect(jinn.hp).to.be.below(jinnBeforeHP);
			expect(jinn.encounterEffects.length).to.equal(0);
		});
	});
});
