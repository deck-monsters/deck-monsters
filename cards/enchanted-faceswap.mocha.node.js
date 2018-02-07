const { expect, sinon } = require('../shared/test-setup');

const { DEFENSE_PHASE } = require('../helpers/phases');
const Basilisk = require('../monsters/basilisk');
const cards = require('./index');
const EnchantedFaceswapCard = require('./enchanted-faceswap');
const RandomCard = require('./random');
const TestCard = require('./test');
const WeepingAngel = require('../monsters/weeping-angel');

describe('./cards/enchanted-faceswap.js', () => {
	it('can be instantiated with defaults', () => {
		const faceswap = new EnchantedFaceswapCard();

		expect(faceswap).to.be.an.instanceof(EnchantedFaceswapCard);
		expect(faceswap.icon).to.equal('👥');
	});

	it('can be drawn', () => {
		const faceswap = new EnchantedFaceswapCard();

		const monster = new WeepingAngel({ name: 'player', xp: 50 });

		expect(monster.canHoldCard(EnchantedFaceswapCard)).to.equal(true);
		expect(monster.canHoldCard(faceswap)).to.equal(true);
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
			.then(() => player.encounterEffects[0]({ card, phase: 'Not DEFENSE_PHASE', player: target }))
			.then(modifiedCard => player.encounterEffects[0]({ card: modifiedCard, phase: DEFENSE_PHASE, player: target }))
			.then(modifiedCard => modifiedCard.play(target, player))
			.then(() => {
				// Card plays reversed
				expect(target.targeted).to.equal(1);
				expect(player.played).to.equal(1);

				// Effect cleans up after itself
				expect(player.encounterEffects.length).to.equal(0);
			});
	});

	it('works with random cards', () => {
		const attack = new TestCard();
		const drawStub = sinon.stub(cards, 'draw');
		const faceswap = new EnchantedFaceswapCard();
		const heal = new TestCard();
		const random = new RandomCard();

		const player = new Basilisk({ name: 'player' });
		const target = new Basilisk({ name: 'target' });

		expect(player.encounterEffects.length).to.equal(0);

		heal.getTargets = cardPlayer => [cardPlayer];

		drawStub.onFirstCall().returns(heal);
		drawStub.onSecondCall().returns(attack);

		const ring = {
			contestants: [
				{ character: {}, monster: player },
				{ character: {}, monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		return faceswap.play(player, target, ring, ring.contestants)
			.then(() => random.play(target, player, ring, ring.contestants))
			.then(() => random.play(target, player, ring, ring.contestants))
			.then(() => {
				drawStub.restore();

				// Card plays reversed
				expect(target.targeted).to.equal(2);
				expect(player.targeted).to.equal(undefined);
				expect(target.played).to.equal(1);
				expect(player.played).to.equal(1);

				// Effect cleans up after itself
				return expect(player.encounterEffects.length).to.equal(0);
			});
	});
});
