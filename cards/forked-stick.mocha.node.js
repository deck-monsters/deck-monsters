const { expect, sinon } = require('../shared/test-setup');

const ForkedStick = require('./forked-stick');
const Basilisk = require('../monsters/basilisk');
const Minotaur = require('../monsters/minotaur');
const Gladiator = require('../monsters/gladiator');
const pause = require('../helpers/pause');

describe('./cards/forked-stick.js', () => {
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
		const forkedStick = new ForkedStick();

		expect(forkedStick).to.be.an.instanceof(ForkedStick);
		expect(forkedStick.attackModifier).to.equal(2);
		expect(forkedStick.damageModifier).to.equal(1);
		expect(forkedStick.stats).to.equal('Hit: 1d20 vs AC / Damage: 1d6\nHit: 1d20+2 vs AC / Damage: 1d6+1 vs Basilisk\nHit: 1d20+2 vs AC / Damage: 1d6-1 vs Minotaur');
	});

	it('can be instantiated with options', () => {
		const forkedStick = new ForkedStick({ damageModifier: 4, attackModifier: 4 });

		expect(forkedStick).to.be.an.instanceof(ForkedStick);
		expect(forkedStick.damageModifier).to.equal(4);
		expect(forkedStick.attackModifier).to.equal(4);
	});

	it('can be played against non-basilisks', () => {
		const forkedStick = new ForkedStick();

		const player = new Minotaur({ name: 'player' });
		const target = new Gladiator({ name: 'target' });
		const dmgRoll = forkedStick.getDamageRoll(player, target);
		const atkRoll = forkedStick.getAttackRoll(player, target);

		expect(dmgRoll.modifier).to.equal(2);
		expect(atkRoll.modifier).to.equal(2);
	});

	it('can be played against basilisks', () => {
		const forkedStick = new ForkedStick();

		const target = new Basilisk({ name: 'player' });
		const player = new Minotaur({ name: 'target' });
		const dmgRoll = forkedStick.getDamageRoll(player, target);
		const atkRoll = forkedStick.getAttackRoll(player, target);

		expect(dmgRoll.modifier).to.equal(3);
		expect(atkRoll.modifier).to.equal(2);
	});

	it('can be played against minotaurs', () => {
		const forkedStick = new ForkedStick();

		const target = new Minotaur({ name: 'player' });
		const player = new Minotaur({ name: 'target' });
		const dmgRoll = forkedStick.getDamageRoll(player, target);
		const atkRoll = forkedStick.getAttackRoll(player, target);

		expect(dmgRoll.modifier).to.equal(1);
		expect(atkRoll.modifier).to.equal(2);
	});
});
