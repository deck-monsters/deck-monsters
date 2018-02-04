/* eslint-disable max-len */
const { expect } = require('../shared/test-setup');

const { ATTACK_PHASE, DEFENSE_PHASE } = require('../helpers/phases');
const Basilisk = require('../monsters/basilisk');
const CloakOfInvisibilityCard = require('./cloak-of-invisibility');
const TestCard = require('./test');
const WeepingAngel = require('../monsters/weeping-angel');

describe('./cards/cloak-of-invisibility.js', () => {
	it('can be instantiated with defaults', () => {
		const invisibility = new CloakOfInvisibilityCard();

		expect(invisibility).to.be.an.instanceof(CloakOfInvisibilityCard);
		expect(invisibility.icon).to.equal('☁️');
		expect(invisibility.stats).to.equal(`You are invisible until you play a card that targets another player, or for the next 2 cards you play (whichever comes first).
1d20 vs your int for opponent to see you on their turn (natural 20 removes your cloak).`);
	});

	it('can be drawn', () => {
		const invisibility = new CloakOfInvisibilityCard();

		const monster = new WeepingAngel({ name: 'player', xp: 50 });

		expect(monster.canHoldCard(CloakOfInvisibilityCard)).to.equal(true);
		expect(monster.canHoldCard(invisibility)).to.equal(true);
	});

	it('can be played', () => {
		const invisibility = new CloakOfInvisibilityCard();

		const player = new WeepingAngel({ name: 'player' });
		const target = new Basilisk({ name: 'target' });

		expect(player.encounterEffects.length).to.equal(0);

		return invisibility
			.play(player, target)
			.then(() => {
				expect(player.encounterEffects.length).to.equal(1);
			});
	});

	it('has an effect', () => {
		const invisibility = new CloakOfInvisibilityCard();
		const card = new TestCard();

		const player = new WeepingAngel({ name: 'player' });
		const target = new Basilisk({ name: 'target' });
		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			]
		};

		invisibility.checkSuccess = () => ({
			strokeOfLuck: false,
			curseOfLoki: false,
			success: false
		});

		expect(player.encounterEffects.length).to.equal(0);

		return card
			.play(target, player, ring, ring.contestants)
			.then(() => {
				// Card plays normally
				expect(target.played).to.equal(1);
				expect(player.targeted).to.equal(1);
			})
			.then(() => invisibility.play(player, target, ring, ring.contestants))
			// Effect activates when the original player is on the defensive
			.then(() => player.encounterEffects[0]({ card, phase: ATTACK_PHASE, player: target, target: player }))
			.then(modifiedCard => player.encounterEffects[0]({ card: modifiedCard, phase: DEFENSE_PHASE, player: target, target: player }))
			.then(modifiedCard => modifiedCard.play(target, player, ring, ring.contestants))
			.then(() => {
				// Card is skipped
				expect(target.played).to.equal(1);
				expect(player.targeted).to.equal(1);

				// Effect remains
				expect(player.encounterEffects.length).to.equal(1);
			})
			// Effect doesn't clear when the card isn't an attack
			.then(() => player.encounterEffects[0]({ card, phase: ATTACK_PHASE, player, target }))
			.then(modifiedCard => player.encounterEffects[0]({ card: modifiedCard, phase: DEFENSE_PHASE, player, target }))
			.then(modifiedCard => modifiedCard.play(player, player, ring, ring.contestants))
			.then(() => {
				// Card plays
				expect(target.played).to.equal(1);
				expect(player.targeted).to.equal(2);
				expect(player.played).to.equal(1);

				// Effect remains
				expect(player.encounterEffects.length).to.equal(1);
			})
			// Effect clears when the card is an attack
			.then(() => player.encounterEffects[0]({ card, phase: ATTACK_PHASE, player, target }))
			.then(modifiedCard => player.encounterEffects[0]({ card: modifiedCard, phase: DEFENSE_PHASE, player, target }))
			.then(modifiedCard => modifiedCard.play(player, target, ring, ring.contestants))
			.then(() => {
				// Card plays
				expect(target.played).to.equal(1);
				expect(player.targeted).to.equal(2);
				expect(player.played).to.equal(2);
				expect(target.targeted).to.equal(1);

				// Effect is cleared
				expect(player.encounterEffects.length).to.equal(0);
			});
	});
});
