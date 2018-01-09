const { expect, sinon } = require('../shared/test-setup');

const Hit = require('./hit');
const WeepingAngel = require('../monsters/weeping-angel');
const Minotaur = require('../monsters/minotaur');
const Basilisk = require('../monsters/basilisk');
const Gladiator = require('../monsters/gladiator');
const Entrance = require('./entrance');
const pause = require('../helpers/pause');


const {
	GLADIATOR, MINOTAUR, BASILISK, WEEPING_ANGEL
} = require('../helpers/creature-types');

describe('./cards/entrance.js', () => {
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
		const entrance = new Entrance();
		const hit = new Hit();

		const stats = `${hit.stats}
Chance to immobilize and damage your opponents with your painfully shocking beauty.`;

		expect(entrance).to.be.an.instanceof(Entrance);
		expect(entrance.freedomThresholdModifier).to.equal(2);
		expect(entrance.attackModifier).to.equal(2);
		expect(entrance.damageModifier).to.equal(0);
		expect(entrance.hitOnFail).to.be.true;
		expect(entrance.doDamageOnImmobilize).to.be.true;
		expect(entrance.stats).to.equal(stats);
		expect(entrance.strongAgainstCreatureTypes).to.deep.equal([GLADIATOR, BASILISK]);
		expect(entrance.weakAgainstCreatureTypes).to.deep.equal([MINOTAUR, WEEPING_ANGEL]);
		expect(entrance.permittedClassesAndTypes).to.deep.equal([WEEPING_ANGEL]);
	});

	it('can be instantiated with options', () => {
		const entrance = new Entrance({
			freedomThresholdModifier: 4, damageModifier: 4, attackModifier: 4, hitOnFail: true, doDamageOnImmobilize: true
		});

		expect(entrance).to.be.an.instanceof(Entrance);
		expect(entrance.freedomThresholdModifier).to.equal(4);
		expect(entrance.attackModifier).to.equal(4);
		expect(entrance.damageModifier).to.equal(4);
		expect(entrance.hitOnFail).to.be.true;
		expect(entrance.doDamageOnImmobilize).to.be.true;
	});

	it('calculates freedom threshold correctly', () => {
		const entrance = new Entrance();
		const player = new WeepingAngel({ name: 'player' });
		const target = new WeepingAngel({ name: 'target' });

		expect(entrance.getFreedomThreshold(player, target)).to.equal(10 + entrance.freedomThresholdModifier);

		target.encounterModifiers = { pinnedTurns: 2 };

		expect(entrance.getFreedomThreshold(player, target)).to.equal(4 + entrance.freedomThresholdModifier);
	});

	it('immobilizes and damages others on success', () => {
		const entrance = new Entrance();
		const checkSuccessStub = sinon.stub(Object.getPrototypeOf(Object.getPrototypeOf(entrance)), 'checkSuccess');

		const player = new WeepingAngel({ name: 'player' });
		const target1 = new Basilisk({ name: 'target1' });
		const target2 = new Minotaur({ name: 'target2' });
		const target3 = new Gladiator({ name: 'target3' });
		const playerStartingHp = player.hp;
		const target1StartingHp = target1.hp;
		const target2StartingHp = target2.hp;
		const target3StartingHp = target3.hp;
		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target1 },
				{ monster: target2 },
				{ monster: target3 }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		checkSuccessStub.returns({ success: true, strokeOfLuck: false, curseOfLoki: false });

		return entrance
			.play(player, target1, ring, ring.contestants)
			.then(() => {
				checkSuccessStub.restore();

				expect(player.encounterEffects.length).to.equal(0);
				expect(player.hp).to.equal(playerStartingHp);
				expect(target1.encounterEffects.length).to.equal(1);
				expect(target1.hp).to.be.below(target1StartingHp);
				expect(target2.encounterEffects.length).to.equal(1);
				expect(target2.hp).to.be.below(target2StartingHp);
				expect(target3.encounterEffects.length).to.equal(1);
				return expect(target3.hp).to.be.below(target3StartingHp);
			});
	});
});
