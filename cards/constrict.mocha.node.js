const { expect, sinon } = require('../shared/test-setup');

const Hit = require('./hit');
const Basilisk = require('../monsters/basilisk');
const Minotaur = require('../monsters/minotaur');
const Constrict = require('./constrict');
const pause = require('../helpers/pause');

const { GLADIATOR, MINOTAUR, BASILISK, JINN } = require('../helpers/creature-types');

describe('./cards/constrict.js', () => {
	let channelStub;
	let pauseStub;

	before(() => {
		channelStub = sinon.stub();
		pauseStub = sinon.stub(pause, 'setTimeout');
	});

	beforeEach(() => {
		channelStub.resolves();
		pauseStub.callsArg(0);
	});

	afterEach(() => {
		channelStub.reset();
		pauseStub.reset();
	});

	after(() => {
		pause.setTimeout.restore();
	});

	it('can be instantiated with defaults', () => {
		const constrict = new Constrict();
		const hit = new Hit({ targetProp: constrict.targetProp });

		const stats = `Immobilize opponent by coiling your serpentine body around them and squeezing, or hit instead if opponent is immune.

${hit.stats}
 +3 advantage vs Gladiator, Minotaur
 -3 disadvantage vs Basilisk, Jinn

Opponent breaks free by rolling 1d20 vs immobilizer's DEX +/- advantage/disadvantage - (turns immobilized * 3)
Hits immobilizer back on stroke of luck.
Turns immobilized resets on curse of loki.

-2 hp each turn immobilized.`;

		expect(constrict).to.be.an.instanceof(Constrict);
		expect(constrict.freedomThresholdModifier).to.equal(3);
		expect(constrict.freedomSavingThrowTargetAttr).to.equal('dex');
		expect(constrict.targetProp).to.equal('dex');
		expect(constrict.doDamageOnImmobilize).to.be.true;
		expect(constrict.ongoingDamage).to.equal(2);
		expect(constrict.stats).to.equal(stats);
		expect(constrict.strongAgainstCreatureTypes).to.deep.equal([GLADIATOR, MINOTAUR]);
		expect(constrict.weakAgainstCreatureTypes).to.deep.equal([BASILISK, JINN]);
		expect(constrict.uselessAgainstCreatureTypes).to.deep.equal([]);
		expect(constrict.permittedClassesAndTypes).to.deep.equal([BASILISK]);
	});

	it('can be instantiated with options', () => {
		const constrict = new Constrict({
			freedomThresholdModifier: 2, doDamageOnImmobilize: false, ongoingDamage: 3// eslint-disable-line max-len
		});

		expect(constrict).to.be.an.instanceof(Constrict);
		expect(constrict.freedomThresholdModifier).to.equal(2);
		expect(constrict.doDamageOnImmobilize).to.be.false;
		expect(constrict.ongoingDamage).to.equal(3);
	});

	it('do damage on immobilize', () => {
		const constrict = new Constrict();
		const checkSuccessStub = sinon.stub(Object.getPrototypeOf(Object.getPrototypeOf(constrict)), 'checkSuccess');
		const hitCheckStub = sinon.stub(Object.getPrototypeOf(Object.getPrototypeOf(constrict)), 'hitCheck');

		const player = new Minotaur({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const before = target.hp;

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		const attackRoll = constrict.getAttackRoll(player, target);
		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });
		hitCheckStub.returns({
			attackRoll,
			success: true,
			strokeOfLuck: false,
			curseOfLoki: false
		});

		return constrict
			.play(player, target, ring, ring.contestants)
			.then(() => {
				checkSuccessStub.restore();
				hitCheckStub.restore();

				expect(target.hp).to.be.below(before);
				return expect(target.encounterEffects.length).to.equal(1);
			});
	});
});
