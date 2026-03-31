import { expect } from 'chai';
import sinon from 'sinon';

import { HitCard } from './hit.js';
import { EntranceCard } from './entrance.js';
import Basilisk from '../monsters/basilisk.js';
import Gladiator from '../monsters/gladiator.js';
import Jinn from '../monsters/jinn.js';
import Minotaur from '../monsters/minotaur.js';
import WeepingAngel from '../monsters/weeping-angel.js';
import { GLADIATOR, JINN, MINOTAUR, BASILISK, WEEPING_ANGEL } from '../constants/creature-types.js';

describe('./cards/entrance.ts', () => {
	let angel: any;
	let basilisk: any;
	let gladiator: any;
	let jinn: any;
	let minotaur: any;
	let player: any;
	let ring: any;
	let entrance: EntranceCard;
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

		entrance = new EntranceCard();
		const entranceProto = Object.getPrototypeOf(entrance);
		const enthrallProto = Object.getPrototypeOf(entranceProto);
		const immobilizeProto = Object.getPrototypeOf(enthrallProto);
		const hitProto = Object.getPrototypeOf(immobilizeProto);
		const baseProto = Object.getPrototypeOf(hitProto);
		checkSuccessStub = sinon.stub(baseProto, 'checkSuccess');
		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });
	});

	afterEach(() => {
		checkSuccessStub.restore();
	});

	it('can be instantiated with defaults', () => {
		const hit = new HitCard({ targetProp: (entrance as any).targetProp });

		const stats = `Immobilize and hit all opponents.

If already immobilized, hit instead.
${hit.stats}
 +2 advantage vs Basilisk, Gladiator
 -2 disadvantage vs Minotaur, Weeping Angel
inneffective against Jinn

Opponent breaks free by rolling 1d20 vs immobilizer's int +/- advantage/disadvantage - (turns immobilized * 3)
Hits immobilizer back on stroke of luck.
Turns immobilized resets on curse of loki.

-1 hp each turn immobilized.`;

		expect(entrance).to.be.an.instanceof(EntranceCard);
		expect((entrance as any).freedomThresholdModifier).to.equal(2);
		expect((entrance as any).freedomSavingThrowTargetAttr).to.equal('int');
		expect((entrance as any).targetProp).to.equal('int');
		expect((entrance as any).doDamageOnImmobilize).to.be.true;
		expect(entrance.stats).to.equal(stats);
		expect((entrance as any).strongAgainstCreatureTypes).to.deep.equal([BASILISK, GLADIATOR]);
		expect((entrance as any).weakAgainstCreatureTypes).to.deep.equal([MINOTAUR, WEEPING_ANGEL]);
		expect((entrance as any).permittedClassesAndTypes).to.deep.equal([WEEPING_ANGEL]);
		expect((entrance as any).uselessAgainstCreatureTypes).to.deep.equal([JINN]);
	});

	it('can be instantiated with options', () => {
		const customEntrance = new EntranceCard({ freedomThresholdModifier: 4, doDamageOnImmobilize: true } as any);

		expect(customEntrance).to.be.an.instanceof(EntranceCard);
		expect((customEntrance as any).freedomThresholdModifier).to.equal(4);
		expect((customEntrance as any).doDamageOnImmobilize).to.be.true;
	});

	it('calculates attackModifier correctly', () => {
		expect((entrance as any).getAttackModifier(angel)).to.equal(-2);
		expect((entrance as any).getAttackModifier(basilisk)).to.equal(2);
		expect((entrance as any).getAttackModifier(gladiator)).to.equal(2);
		expect((entrance as any).getAttackModifier(jinn)).to.equal(0);
		expect((entrance as any).getAttackModifier(minotaur)).to.equal(-2);
	});

	it('calculates freedom threshold correctly', () => {
		expect((entrance as any).getFreedomThreshold(player, angel)).to.equal(5);
		expect((entrance as any).getFreedomThreshold(player, basilisk)).to.equal(9);
		expect((entrance as any).getFreedomThreshold(player, gladiator)).to.equal(9);
		expect((entrance as any).getFreedomThreshold(player, jinn)).to.equal(7);
		expect((entrance as any).getFreedomThreshold(player, minotaur)).to.equal(5);

		angel.encounterModifiers.immobilizedTurns = 2;
		basilisk.encounterModifiers.immobilizedTurns = 2;
		minotaur.encounterModifiers.immobilizedTurns = 2;
		gladiator.encounterModifiers.immobilizedTurns = 2;
		jinn.encounterModifiers.immobilizedTurns = 2;

		expect((entrance as any).getFreedomThreshold(player, angel)).to.equal(1);
		expect((entrance as any).getFreedomThreshold(player, basilisk)).to.equal(3);
		expect((entrance as any).getFreedomThreshold(player, gladiator)).to.equal(3);
		expect((entrance as any).getFreedomThreshold(player, jinn)).to.equal(1);
		expect((entrance as any).getFreedomThreshold(player, minotaur)).to.equal(1);
	});

	it('immobilizes and hits others on play', () => {
		const playerBeforeHP = player.hp;
		const angelBeforeHP = angel.hp;
		const basiliskBeforeHP = basilisk.hp;
		const gladiatorBeforeHP = gladiator.hp;
		const jinnBeforeHP = jinn.hp;
		const minotaurBeforeHP = minotaur.hp;

		return entrance.play(player, basilisk, ring, ring.contestants).then(() => {
			expect(player.encounterEffects.length).to.equal(0);
			expect(angel.encounterEffects.length).to.equal(1);
			expect(basilisk.encounterEffects.length).to.equal(1);
			expect(gladiator.encounterEffects.length).to.equal(1);
			expect(jinn.encounterEffects.length).to.equal(0);
			expect(minotaur.encounterEffects.length).to.equal(1);
			expect(player.hp).to.equal(playerBeforeHP);
			expect(angel.hp).to.be.below(angelBeforeHP);
			expect(basilisk.hp).to.be.below(basiliskBeforeHP);
			expect(gladiator.hp).to.be.below(gladiatorBeforeHP);
			expect(jinn.hp).to.be.below(jinnBeforeHP);
			expect(minotaur.hp).to.be.below(minotaurBeforeHP);
		});
	});
});
