const { expect, sinon } = require('../shared/test-setup');

const ThickSkinCard = require('./thick-skin');
const Basilisk = require('../monsters/basilisk');
const pause = require('../helpers/pause');

describe('./cards/thick-skin.js', () => {
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
		const thickSkin = new ThickSkinCard();

		expect(thickSkin).to.be.an.instanceof(ThickSkinCard);
		expect(thickSkin.icon).to.equal('🔬');
		expect(thickSkin.boostAmount).to.equal(2);
		expect(thickSkin.boostedProp).to.equal('ac');
		expect(thickSkin.stats).to.equal('Boost: ac +2');
	});

	it('increases ac', () => {
		const thickSkin = new ThickSkinCard();

		const player = new Basilisk({ name: 'player' });
		const before = player.ac;

		return thickSkin.play(player)
			.then((result) => {
				expect(result).to.equal(true);
				return expect(player.ac).to.be.above(before);
			});
	});
});
