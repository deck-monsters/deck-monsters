const { expect } = require('../shared/test-setup');
const { randomContestant } = require('./bosses');
const targetingStrategies = require('./targeting-strategies');

const HitCard = require('../cards/hit');

describe('./helpers/targeting-strategies.js', () => {
	const getContestants = () => {
		const playerContestant = randomContestant({
			name: 'Player Contestant',
			isBoss: false,
			battles: {
				total: 1,
				wins: 1,
				losses: 0
			},
			hpVariance: 0
		});

		const level1 = randomContestant({
			name: 'Level 1',
			isBoss: false,
			battles: {
				total: 5,
				wins: 5,
				losses: 0
			},
			hpVariance: 0
		});

		const level2 = randomContestant({
			name: 'Level 2',
			isBoss: false,
			battles: {
				total: 10,
				wins: 10,
				losses: 0
			},
			hpVariance: 0
		});

		const level3 = randomContestant({
			name: 'Level 3',
			isBoss: false,
			battles: {
				total: 15,
				wins: 15,
				losses: 0
			},
			hpVariance: 0
		});

		return {
			playerContestant,
			level1,
			level2,
			level3,
			contestants: [playerContestant, level3, level1, level2]
		};
	};

	describe('TARGET_HIGHEST_HP_PLAYER', () => {
		it('gets the target with the higest hp', () => {
			const {
				playerContestant,
				level1,
				level2,
				level3,
				contestants
			} = getContestants();

			level1.monster.hp = 5;
			level2.monster.hp = 5;

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_HIGHEST_HP_PLAYER
			});

			expect(target.monster.givenName).to.equal(level3.monster.givenName);
		});

		it('gets the target with the higest current hp', () => {
			const {
				playerContestant,
				level1,
				level2,
				level3,
				contestants
			} = getContestants();

			level1.monster.hp = 5;
			level3.monster.hp = 5;

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_HIGHEST_HP_PLAYER
			});

			expect(target.monster.givenName).to.equal(level2.monster.givenName);
		});
	});

	describe('TARGET_MAX_HP_PLAYER', () => {
		it('gets the target with the highest max hp', () => {
			const {
				playerContestant,
				level3,
				contestants
			} = getContestants();

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_MAX_HP_PLAYER
			});

			expect(target.monster.givenName).to.equal(level3.monster.givenName);
		});
	});

	describe('TARGET_PLAYER_WHO_HIT_YOU_LAST', () => {
		it('gets the default target if not yet hit', () => {
			const {
				playerContestant,
				contestants
			} = getContestants();

			const defaulTarget = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_NEXT_PLAYER
			});

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_PLAYER_WHO_HIT_YOU_LAST
			});

			expect(target).to.equal(defaulTarget);
		});

		it('targets the player who hit you last', () => {
			const {
				playerContestant,
				level3,
				contestants
			} = getContestants();

			const hit = new HitCard();

			playerContestant.monster.hit(1, level3.monster, hit);

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_PLAYER_WHO_HIT_YOU_LAST
			});

			expect(target.character.givenName).to.equal(level3.character.givenName);
		});
	});

	describe('TARGET_NEXT_PLAYER', () => {
		it('gets the next target in order of play', () => {
			const {
				playerContestant,
				level3,
				contestants
			} = getContestants();

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_NEXT_PLAYER
			});

			expect(target.monster.givenName).to.equal(level3.monster.givenName);
		});

		it('defaults to TARGET_NEXT_PLAYER', () => {
			const {
				level3: playerContestant,
				level1,
				contestants
			} = getContestants();

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_NEXT_PLAYER
			});

			expect(target.monster.givenName).to.equal(level1.monster.givenName);
		});
	});
});
