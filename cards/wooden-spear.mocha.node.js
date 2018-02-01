const { expect, sinon } = require('../shared/test-setup');

const WoodenSpearCard = require('./wooden-spear');
const Basilisk = require('../monsters/basilisk');
const Minotaur = require('../monsters/minotaur');
const pause = require('../helpers/pause');

describe('./cards/wooden-spear.js', () => {
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
		const woodenSpear = new WoodenSpearCard();

		expect(woodenSpear).to.be.an.instanceof(WoodenSpearCard);
		expect(woodenSpear.strModifier).to.equal(3);
		expect(woodenSpear.stats).to.equal('Hit: 1d20 vs ac / Damage: 1d6\n+3 damage vs Minotaur');
	});

	it('can be instantiated with options', () => {
		const woodenSpear = new WoodenSpearCard({ strModifier: 4 });

		expect(woodenSpear).to.be.an.instanceof(WoodenSpearCard);
		expect(woodenSpear.strModifier).to.equal(4);
	});

	it('can be played against non-minotaurs', () => {
		const woodenSpear = new WoodenSpearCard();

		const player = new Basilisk({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const roll = woodenSpear.getDamageRoll(player, target);

		expect(roll.modifier).to.equal(2);
	});

	it('can be played against minotaurs', () => {
		const woodenSpear = new WoodenSpearCard();

		const player = new Basilisk({ name: 'player' });
		const target = new Minotaur({ name: 'target' });
		const roll = woodenSpear.getDamageRoll(player, target);

		expect(roll.modifier).to.equal(5);
	});
});
