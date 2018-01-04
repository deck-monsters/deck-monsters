const { expect, sinon } = require('../shared/test-setup');

const BrainDrainCard = require('./brain-drain');
const Gladiator = require('../monsters/gladiator');
const pause = require('../helpers/pause');
const HitCard = require('./hit');

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
		const hit = new HitCard({ damageDice: '1d4' });

		const stats = `${hit.stats}
Curse: xp -20`;

		expect(brainDrain).to.be.an.instanceof(BrainDrainCard);
		expect(brainDrain.icon).to.equal('🤡');
		expect(brainDrain.curseAmount).to.equal(-20);
		expect(brainDrain.cursedProp).to.equal('xp');
		expect(brainDrain.stats).to.equal(stats);
	});

	it('decreases xp', () => {
		const brainDrain = new BrainDrainCard();

		const player = new Gladiator({ name: 'player' });
		const target = new Gladiator({ name: 'target' });
		target.xp = 300;

		expect(target.xp).to.equal(300);

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		return brainDrain.play(player, target, ring)
			.then((result) => {
				expect(result).to.equal(true);
				return expect(target.xp).to.equal(280);
			});
	});
});
