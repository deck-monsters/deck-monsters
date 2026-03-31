import { expect } from 'chai';
import sinon from 'sinon';

import { HitCard } from './hit.js';
import { MesmerizeCard } from './mesmerize.js';
import Basilisk from '../monsters/basilisk.js';
import Gladiator from '../monsters/gladiator.js';
import Jinn from '../monsters/jinn.js';
import Minotaur from '../monsters/minotaur.js';
import WeepingAngel from '../monsters/weeping-angel.js';
import { ATTACK_PHASE } from '../constants/phases.js';
import { BASILISK, GLADIATOR, JINN, MINOTAUR, WEEPING_ANGEL } from '../constants/creature-types.js';

describe('./cards/mesmerize.ts', () => {
	let angel: any;
	let basilisk: any;
	let gladiator: any;
	let jinn: any;
	let minotaur: any;
	let player: any;
	let ring: any;
	let mesmerize: MesmerizeCard;
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

		mesmerize = new MesmerizeCard();
		const mesmerizeProto = Object.getPrototypeOf(mesmerize);
		const immobilizeProto = Object.getPrototypeOf(mesmerizeProto);
		const hitProto = Object.getPrototypeOf(immobilizeProto);
		baseProto = Object.getPrototypeOf(hitProto);
		checkSuccessStub = sinon.stub(baseProto, 'checkSuccess');
		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });
	});

	afterEach(() => {
		checkSuccessStub.restore();
	});

	it('can be instantiated with defaults', () => {
		const hit = new HitCard({ targetProp: (mesmerize as any).targetProp });

		const stats = `Immobilize everyone.

If already immobilized, hit instead.
${hit.stats}
 +2 advantage vs Basilisk, Gladiator
 -2 disadvantage vs Minotaur, Weeping Angel
inneffective against Jinn

Opponent breaks free by rolling 1d20 vs immobilizer's int +/- advantage/disadvantage - (turns immobilized * 3)
Hits immobilizer back on stroke of luck.
Turns immobilized resets on curse of loki.
`;

		expect(mesmerize).to.be.an.instanceof(MesmerizeCard);
		expect((mesmerize as any).freedomThresholdModifier).to.equal(2);
		expect((mesmerize as any).freedomSavingThrowTargetAttr).to.equal('int');
		expect((mesmerize as any).targetProp).to.equal('int');
		expect((mesmerize as any).doDamageOnImmobilize).to.be.false;
		expect(mesmerize.stats).to.equal(stats);
		expect((mesmerize as any).strongAgainstCreatureTypes).to.deep.equal([BASILISK, GLADIATOR]);
		expect((mesmerize as any).weakAgainstCreatureTypes).to.deep.equal([MINOTAUR, WEEPING_ANGEL]);
		expect((mesmerize as any).permittedClassesAndTypes).to.deep.equal([WEEPING_ANGEL]);
		expect((mesmerize as any).uselessAgainstCreatureTypes).to.deep.equal([JINN]);
		expect((mesmerize as any).immobilizeCheck()).to.be.true;
	});

	it('can be instantiated with options', () => {
		const customMesmerize = new MesmerizeCard({ freedomThresholdModifier: 4, doDamageOnImmobilize: true } as any);

		expect(customMesmerize).to.be.an.instanceof(MesmerizeCard);
		expect((customMesmerize as any).freedomThresholdModifier).to.equal(4);
		expect((customMesmerize as any).doDamageOnImmobilize).to.be.true;
	});

	it('calculates attackModifier correctly', () => {
		expect((mesmerize as any).getAttackModifier(angel)).to.equal(-2);
		expect((mesmerize as any).getAttackModifier(basilisk)).to.equal(2);
		expect((mesmerize as any).getAttackModifier(gladiator)).to.equal(2);
		expect((mesmerize as any).getAttackModifier(jinn)).to.equal(0);
		expect((mesmerize as any).getAttackModifier(minotaur)).to.equal(-2);
	});

	it('calculates freedom threshold correctly', () => {
		expect((mesmerize as any).getFreedomThreshold(player, angel)).to.equal(5);
		expect((mesmerize as any).getFreedomThreshold(player, basilisk)).to.equal(9);
		expect((mesmerize as any).getFreedomThreshold(player, gladiator)).to.equal(9);
		expect((mesmerize as any).getFreedomThreshold(player, jinn)).to.equal(7);
		expect((mesmerize as any).getFreedomThreshold(player, minotaur)).to.equal(5);

		angel.encounterModifiers.immobilizedTurns = 2;
		basilisk.encounterModifiers.immobilizedTurns = 2;
		minotaur.encounterModifiers.immobilizedTurns = 2;
		gladiator.encounterModifiers.immobilizedTurns = 2;
		jinn.encounterModifiers.immobilizedTurns = 2;

		expect((mesmerize as any).getFreedomThreshold(player, angel)).to.equal(1);
		expect((mesmerize as any).getFreedomThreshold(player, basilisk)).to.equal(3);
		expect((mesmerize as any).getFreedomThreshold(player, gladiator)).to.equal(3);
		expect((mesmerize as any).getFreedomThreshold(player, jinn)).to.equal(1);
		expect((mesmerize as any).getFreedomThreshold(player, minotaur)).to.equal(1);
	});

	it('immobilizes everyone on play', () =>
		mesmerize.play(player, basilisk, ring, ring.contestants).then(() => {
			expect(player.encounterEffects.length).to.equal(1);
			expect(angel.encounterEffects.length).to.equal(1);
			expect(basilisk.encounterEffects.length).to.equal(1);
			expect(gladiator.encounterEffects.length).to.equal(1);
			expect(jinn.encounterEffects.length).to.equal(0);
			expect(minotaur.encounterEffects.length).to.equal(1);
		}));

	it('hits already immobilized monsters on play', () => {
		const playerBeforeHP = player.hp;
		const angelBeforeHP = angel.hp;
		const basiliskBeforeHP = basilisk.hp;
		const gladiatorBeforeHP = gladiator.hp;
		const jinnBeforeHP = jinn.hp;
		const minotaurBeforeHP = minotaur.hp;

		return mesmerize
			.play(player, basilisk, ring, ring.contestants)
			.then(() =>
				mesmerize.play(player, basilisk, ring, ring.contestants, false).then(() => {
					expect(player.hp).to.be.below(playerBeforeHP);
					expect(angel.hp).to.be.below(angelBeforeHP);
					expect(basilisk.hp).to.be.below(basiliskBeforeHP);
					expect(gladiator.hp).to.be.below(gladiatorBeforeHP);
					expect(jinn.hp).to.be.below(jinnBeforeHP);
					expect(minotaur.hp).to.be.below(minotaurBeforeHP);
				})
			);
	});

	it('hits immune players on play', () => {
		const jinnBeforeHP = jinn.hp;

		return mesmerize.play(player, jinn, ring, ring.contestants).then(() => {
			expect(jinn.hp).to.be.below(jinnBeforeHP);
			expect(jinn.encounterEffects.length).to.equal(0);
		});
	});

	it('harms immobilizer on breaking free with natural 20', () => {
		const playerBeforeHP = player.hp;

		return mesmerize
			.play(player, basilisk, ring, ring.contestants)
			.then(() => {
				expect(basilisk.encounterEffects[0].effectType).to.equal('ImmobilizeEffect');

				checkSuccessStub.returns({ success: true, strokeOfLuck: true, curseOfLoki: false });

				const card = basilisk.encounterEffects.reduce((currentCard: any, effect: any) => {
					const modifiedCard = effect({
						activeContestants: [basilisk, player],
						card: currentCard,
						phase: ATTACK_PHASE,
						player,
						ring,
						basilisk,
					});
					return modifiedCard || currentCard;
				}, new HitCard());

				return card.play(basilisk, player, ring, ring.contestants).then(() => {
					expect(player.hp).to.be.below(playerBeforeHP);
					expect(basilisk.encounterEffects.length).to.equal(0);
				});
			});
	});
});
