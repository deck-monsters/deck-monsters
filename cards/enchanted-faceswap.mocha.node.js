const { expect, sinon } = require('../shared/test-setup');

const EnchantedFaceswapCard = require('./enchanted-faceswap');
const TestCard = require('./test');
const Basilisk = require('../monsters/basilisk');
const { DEFENSE_PHASE } = require('../helpers/phases');
const pause = require('../helpers/pause');

describe('./cards/enchanted-faceswap.js', () => {
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
		const faceswap = new EnchantedFaceswapCard();

		expect(faceswap).to.be.an.instanceof(EnchantedFaceswapCard);
		expect(faceswap.icon).to.equal('👥');
	});

	it('can be played', () => {
		const faceswap = new EnchantedFaceswapCard();

		const player = new Basilisk({ name: 'player' });
		const target = new Basilisk({ name: 'target' });

		expect(player.encounterEffects.length).to.equal(0);

		return faceswap
			.play(player, target)
			.then(() => {
				expect(player.encounterEffects.length).to.equal(1);
			});
	});

	it('has an effect', () => {
		const faceswap = new EnchantedFaceswapCard();
		const card = new TestCard();

		const player = new Basilisk({ name: 'player' });
		const target = new Basilisk({ name: 'target' });

		expect(player.encounterEffects.length).to.equal(0);

		return card
			.play(target, player)
			.then(() => {
				// Card plays normally
				expect(target.played).to.equal(1);
				expect(player.targeted).to.equal(1);
			})
			.then(() => faceswap.play(player, target))
			// Effect only activates in defense phase
			.then(() => player.encounterEffects[0]({ card, phase: 'Not DEFENSE_PHASE' }))
			.then(modifiedCard => player.encounterEffects[0]({ card: modifiedCard, phase: DEFENSE_PHASE }))
			.then(modifiedCard => modifiedCard.play(target, player))
			.then(() => {
				// Card plays reversed
				expect(target.targeted).to.equal(1);
				expect(player.played).to.equal(1);

				// Effect cleans up after itself
				expect(player.encounterEffects.length).to.equal(0);
			});
	});
});
