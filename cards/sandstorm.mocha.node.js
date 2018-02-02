/* eslint-disable max-len */
const { expect, sinon } = require('../shared/test-setup');

const { ATTACK_PHASE } = require('../helpers/phases');
const cards = require('./index');
const Jinn = require('../monsters/jinn');
const RandomCard = require('./random');
const SandstormCard = require('./sandstorm');
const TestCard = require('./test');

describe('./cards/sandstorm.js', () => {
	it('can be instantiated with defaults', () => {
		const sandstorm = new SandstormCard();

		expect(sandstorm).to.be.an.instanceof(SandstormCard);
		expect(sandstorm.hitProbability).to.equal(30);
		expect(sandstorm.stats).to.equal('1 storm damage +1 per level of the jinni to everyone in the ring. Temporarily confuses opponents and causes them to mistake their targets.');
	});

	it('can be played', () => {
		const sandstorm = new SandstormCard();

		const player = new Jinn({ name: 'player' });
		const target1 = new Jinn({ name: 'target1' });
		const target2 = new Jinn({ name: 'target2' });
		const ring = {
			contestants: [
				{ character: {}, monster: player },
				{ character: {}, monster: target1 },
				{ character: {}, monster: target2 }
			]
		};

		const playerStartingHp = player.hp;
		const playerLevel = player.level;
		const damage = 1 + (1 * playerLevel);
		const target1StartingHp = target1.hp;
		const target2StartingHp = target2.hp;

		return sandstorm
			.play(player, target1, ring, ring.contestants)
			.then(() => {
				expect(player.hp).to.equal(playerStartingHp);
				expect(target1.hp).to.equal(target1StartingHp - damage);
				expect(target2.hp).to.equal(target2StartingHp - damage);
			});
	});

	it('has an effect', () => {
		const sandstorm = new SandstormCard({ hitProbability: 0 });

		const player = new Jinn({ name: 'player' });
		const target1 = new Jinn({ name: 'target1' });
		const target2 = new Jinn({ name: 'target2' });
		const ring = {
			contestants: [
				{ character: {}, monster: player },
				{ character: {}, monster: target1 },
				{ character: {}, monster: target2 }
			]
		};

		const card = new TestCard({ targets: [player] });

		expect(sandstorm.hitProbability).to.equal(0);
		expect(target1.encounterEffects.length).to.equal(0);
		expect(target2.encounterEffects.length).to.equal(0);

		return card
			.play(target1, player)
			.then(() => {
				// Card plays normally
				expect(target1.played).to.equal(1);
				expect(player.targeted).to.equal(1);
			})
			.then(() => sandstorm.play(player, target1, ring, ring.contestants))
			// Effect only activates in attack phase
			.then(() => target1.encounterEffects[0]({ card, phase: ATTACK_PHASE, player: target1 }))
			.then(modifiedCard => modifiedCard.play(target1, player, ring, ring.contestants))
			.then(() => {
				// Effect changes the target
				expect(target1.played).to.equal(2);
				expect(player.targeted).to.equal(1);
				expect((target1.targeted || 0) + (target2.targeted || 0)).to.equal(1);

				// Effect cleans up after itself
				expect(target1.encounterEffects.length).to.equal(0);
				expect(target2.encounterEffects.length).to.equal(1);
			});
	});

	it('works with random cards', () => {
		const attack = new TestCard();
		const drawStub = sinon.stub(cards, 'draw');
		const sandstorm = new SandstormCard({ healProbability: 100, hitProbability: 0 });
		const heal = new TestCard();
		const random = new RandomCard();

		const player = new Jinn({ name: 'player' });
		const target1 = new Jinn({ name: 'target1' });
		const target2 = new Jinn({ name: 'target2' });
		const ring = {
			contestants: [
				{ character: {}, monster: player },
				{ character: {}, monster: target1 },
				{ character: {}, monster: target2 }
			]
		};

		expect(target1.encounterEffects.length).to.equal(0);
		expect(target2.encounterEffects.length).to.equal(0);

		heal.getTargets = cardPlayer => [cardPlayer];

		drawStub.onFirstCall().returns(heal);
		drawStub.onSecondCall().returns(attack);

		return sandstorm
			.play(player, target1, ring, ring.contestants)
			.then(() => target1.encounterEffects[0]({ card: random.clone(), phase: ATTACK_PHASE, player: target1 }))
			.then(modifiedCard => modifiedCard.play(target1, player, ring, ring.contestants))
			.then(() => {
				expect(target1.played).to.equal(1);
				expect(target1.targeted).to.equal(undefined);
				expect(player.targeted).to.equal(1);
			})
			.then(() => target2.encounterEffects[0]({ card: random.clone(), phase: ATTACK_PHASE, player: target2 }))
			.then(modifiedCard => modifiedCard.play(target2, player, ring, ring.contestants))
			.then(() => {
				drawStub.restore();

				// Effect changes the target
				expect(target1.played).to.equal(1);
				expect(target2.played).to.equal(1);
				expect(player.targeted).to.equal(1);
				expect((target1.targeted || 0) + (target2.targeted || 0)).to.equal(1);

				// Effect cleans up after itself
				expect(target1.encounterEffects.length).to.equal(0);
				expect(target2.encounterEffects.length).to.equal(0);
			});
	});

	it('has hit flavors', () => {
		const sandstorm = new SandstormCard();

		expect(sandstorm.flavors.hits).to.be.an('array');
	});
});
