const { expect, sinon } = require('../shared/test-setup');

const BrainDrainCard = require('./brain-drain');
const Gladiator = require('../monsters/gladiator');
const pause = require('../helpers/pause');

describe('./cards/brain-drain.js', () => {
	let pauseStub;

	before(() => {
		pauseStub = sinon.stub(pause, 'setTimeout');
	});

	beforeEach(() => {
		pauseStub.callsArg(0);
	});

	afterEach(() => {
		pauseStub.reset();
	});

	after(() => {
		pause.setTimeout.restore();
	});

	it('can be instantiated with defaults', () => {
		const brainDrain = new BrainDrainCard();

		expect(brainDrain).to.be.an.instanceof(BrainDrainCard);
		expect(brainDrain.icon).to.equal('🤡');
		expect(brainDrain.curseAmount).to.equal(-10);
		expect(brainDrain.cursedProp).to.equal('xp');
		expect(brainDrain.stats).to.equal('Curse: xp -10');
	});

	it('decreases xp', () => {
		const brainDrain = new BrainDrainCard();

		const player = new Gladiator({ name: 'player' });
		const target = new Gladiator({ name: 'target' });
		target.xp = 300;

		return brainDrain.play(player, target)
			.then((result) => {
				expect(result).to.equal(true);
				return expect(target.xp).to.equal(290);
			});
	});
});
