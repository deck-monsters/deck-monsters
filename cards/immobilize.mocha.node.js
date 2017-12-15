const { expect, sinon } = require('../shared/test-setup');

const Hit = require('./hit');
const Basilisk = require('../monsters/basilisk');
const Minotaur = require('../monsters/minotaur');
const Gladiator = require('../monsters/gladiator');
const Immobilize = require('./immobilize');
const pause = require('../helpers/pause');

const { FIGHTER, BARBARIAN } = require('../helpers/classes');
const { GLADIATOR, MINOTAUR, BASILISK } = require('../helpers/creature-types');

describe('./cards/immobilize.js', () => {
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
		const immobilize = new Immobilize();
		const hit = new Hit();

		expect(immobilize).to.be.an.instanceof(Immobilize);
		expect(immobilize.attackModifier).to.equal(2);
		expect(immobilize.damageModifier).to.equal(0);
		expect(immobilize.hitOnFail).to.equal(false);
		expect(immobilize.alwaysDoDamage).to.equal(false);
		expect(immobilize.stats).to.equal(hit.stats);
		expect(immobilize.strongAgainstCreatureTypes).to.equal.([GLADIATOR]);
		expect(immobilize.weakAgainstCreatureTypes).to.equal.([MINOTAUR]);
	});

	it('can be instantiated with options', () => {
		const immobilize = new Immobilize({ damageModifier: 4, attackModifier: 4, hitOnFail: true, alwaysDoDamage: true });

		expect(immobilize).to.be.an.instanceof(Immobilize);
		expect(immobilize.attackModifier).to.equal(2);
		expect(immobilize.damageModifier).to.equal(0);
		expect(immobilize.hitOnFail).to.equal(true);
		expect(immobilize.alwaysDoDamage).to.equal(true);
	});

	it('can be played against gladiators for a bonus to attack', () => {
		const immobilize = new Immobilize();

		const player = new Minotaur({ name: 'player' });
		const target = new Gladiator({ name: 'target' });
		const atkRoll = immobilize.getAttackRoll(player, target);
		const dmgRoll = immobilize.getDamageRoll(player, target);

		expect(atkRoll.modifier).to.equal(player.attackModifier + 2);
		expect(dmgRoll.modifier).to.equal(player.damageModifier);
	});

	it('can be played against minotaurs for a weakened attack', () => {
		const immobilize = new Immobilize();

		const player = new Gladiator({ name: 'player' });
		const target = new Minotaur({ name: 'target' });
		const atkRoll = immobilize.getAttackRoll(player, target);
		const dmgRoll = immobilize.getDamageRoll(player, target);

		expect(atkRoll.modifier).to.equal(player.attackModifier - 2);
		expect(dmgRoll.modifier).to.equal(player.damageModifier);
	});

	it('can be played against basilisks with no bonus/penalty', () => {
		const immobilize = new Immobilize();

		const target = new Basilisk({ name: 'player' });
		const player = new Minotaur({ name: 'target' });
		const dmgRoll = immobilize.getDamageRoll(player, target);
		const atkRoll = immobilize.getAttackRoll(player, target);

		expect(dmgRoll.modifier).to.equal(player.attackModifier);
		expect(atkRoll.modifier).to.equal(player.damageModifier);
	});
});
