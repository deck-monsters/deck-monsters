const { expect, sinon } = require('../shared/test-setup');

const Hit = require('./hit');
const Basilisk = require('../monsters/basilisk');
const Minotaur = require('../monsters/minotaur');
const Coil = require('./coil');
const pause = require('../helpers/pause');
const { roll } = require('../helpers/chance');

const { GLADIATOR, MINOTAUR, BASILISK } = require('../helpers/creature-types');

describe.only('./cards/coil.js', () => {
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
		const coil = new Coil();
		const hit = new Hit();

		const stats = `${hit.stats}
Chance to immobilize opponent by coiling your serpentine body around them and then squeezing.`;

		expect(coil).to.be.an.instanceof(Coil);
		expect(coil.freedomThresholdModifier).to.equal(0);
		expect(coil.attackModifier).to.equal(2);
		expect(coil.damageModifier).to.equal(0);
		expect(coil.hitOnFail).to.be.false;
		expect(coil.doDamageOnImmobilize).to.be.false;
		expect(coil.ongoingDamage).to.equal(1);
		expect(coil.stats).to.equal(stats);
		expect(coil.strongAgainstCreatureTypes).to.deep.equal([GLADIATOR, MINOTAUR]);
		expect(coil.weakAgainstCreatureTypes).to.deep.equal([BASILISK]);
		expect(coil.permittedClassesAndTypes).to.deep.equal([BASILISK]);
	});

	it('can be instantiated with options', () => {
		const coil = new Coil({
			freedomThresholdModifier: 2, damageModifier: 4, attackModifier: 4, hitOnFail: true, doDamageOnImmobilize: true, ongoingDamage: 0
		});

		expect(coil).to.be.an.instanceof(Coil);
		expect(coil.freedomThresholdModifier).to.equal(2);
		expect(coil.attackModifier).to.equal(4);
		expect(coil.damageModifier).to.equal(4);
		expect(coil.hitOnFail).to.be.true;
		expect(coil.doDamageOnImmobilize).to.be.true;
		expect(coil.ongoingDamage).to.equal(0);
	});

	it('do not do damage on immobilize', () => {
		const coil = new Coil();
		const checkSuccessStub = sinon.stub(Object.getPrototypeOf(Object.getPrototypeOf(coil)), 'checkSuccess');
		const hitCheckStub = sinon.stub(Object.getPrototypeOf(Object.getPrototypeOf(coil)), 'hitCheck');

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

		const attackRoll = roll({ primaryDice: '1d20', modifier: player.attackModifier, bonusDice: player.bonusAttackDice });

		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });
		hitCheckStub.returns({
			attackRoll,
			success: { success: true, strokeOfLuck: false, curseOfLoki: false },
			strokeOfLuck: false,
			curseOfLoki: false
		});

		return coil
			.play(player, target, ring, ring.contestants)
			.then(() => {
				checkSuccessStub.restore();
				hitCheckStub.restore();

				expect(target.hp).to.equal(before);
				return expect(target.encounterEffects.length).to.equal(1);
			});
	});
});
