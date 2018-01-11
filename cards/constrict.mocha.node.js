const { expect, sinon } = require('../shared/test-setup');

const Hit = require('./hit');
const Basilisk = require('../monsters/basilisk');
const Minotaur = require('../monsters/minotaur');
const Constrict = require('./constrict');
const pause = require('../helpers/pause');
const { roll } = require('../helpers/chance');

const { GLADIATOR, MINOTAUR, BASILISK } = require('../helpers/creature-types');

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
		const hit = new Hit();

		const stats = `${hit.stats}

 +2 against Gladiator, Minotaur
 -2 against Basilisk
inneffective against Weeping Angel
Chance to immobilize opponent by coiling your serpentine body around them and squeezing.`;

		expect(constrict).to.be.an.instanceof(Constrict);
		expect(constrict.freedomThresholdModifier).to.equal(3);
		expect(constrict.attackModifier).to.equal(2);
		expect(constrict.damageModifier).to.equal(0);
		expect(constrict.hitOnFail).to.be.false;
		expect(constrict.doDamageOnImmobilize).to.be.true;
		expect(constrict.ongoingDamage).to.equal(2);
		expect(constrict.stats).to.equal(stats);
		expect(constrict.strongAgainstCreatureTypes).to.deep.equal([GLADIATOR, MINOTAUR]);
		expect(constrict.weakAgainstCreatureTypes).to.deep.equal([BASILISK]);
		expect(constrict.permittedClassesAndTypes).to.deep.equal([BASILISK]);
	});

	it('can be instantiated with options', () => {
		const constrict = new Constrict({
			freedomThresholdModifier: 2, damageModifier: 4, attackModifier: 4, hitOnFail: true, doDamageOnImmobilize: false, ongoingDamage: 3// eslint-disable-line max-len
		});

		expect(constrict).to.be.an.instanceof(Constrict);
		expect(constrict.freedomThresholdModifier).to.equal(2);
		expect(constrict.attackModifier).to.equal(4);
		expect(constrict.damageModifier).to.equal(4);
		expect(constrict.hitOnFail).to.be.true;
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

		const attackRoll = roll({ primaryDice: '1d20', modifier: player.attackModifier, bonusDice: player.bonusAttackDice });

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
