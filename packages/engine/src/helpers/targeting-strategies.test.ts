import { expect } from 'chai';

import { randomContestant } from './bosses.js';
import * as targetingStrategies from './targeting-strategies.js';
import HitCard from '../cards/hit.js';

describe('./helpers/targeting-strategies.ts', () => {
	const getContestants = () => {
		const playerContestant = randomContestant({
			name: 'Player Contestant',
			isBoss: false,
			battles: { total: 1, wins: 1, losses: 0 },
			hpVariance: 0
		});

		const level1 = randomContestant({
			name: 'Level 1',
			isBoss: false,
			battles: { total: 5, wins: 5, losses: 0 },
			hpVariance: 0
		});

		const level2 = randomContestant({
			name: 'Level 2',
			isBoss: false,
			battles: { total: 10, wins: 10, losses: 0 },
			hpVariance: 0
		});

		const level3 = randomContestant({
			name: 'Level 3',
			isBoss: false,
			battles: { total: 15, wins: 15, losses: 0 },
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

	describe('TARGET_HUMAN_PLAYER_WEAK', () => {
		it('targets the person next to you if they are human', () => {
			const { playerContestant, level1, level2, level3, contestants } = getContestants();

			playerContestant.isBoss = true;
			level1.isBoss = true;
			level2.isBoss = true;

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_HUMAN_PLAYER_WEAK
			}) as typeof level3;

			expect(target.monster.givenName).to.equal(level3.monster.givenName);
		});

		it('finds a human to target if there is one', () => {
			const { playerContestant, level1, level2, level3, contestants } = getContestants();

			playerContestant.isBoss = true;
			level3.isBoss = true;
			level1.isBoss = true;

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_HUMAN_PLAYER_WEAK
			}) as typeof level2;

			expect(target.monster.givenName).to.equal(level2.monster.givenName);
		});

		it('targets the boss next to you if no humans are left', () => {
			const { playerContestant, level1, level2, level3, contestants } = getContestants();

			playerContestant.isBoss = true;
			level3.isBoss = true;
			level1.isBoss = true;
			level2.isBoss = true;

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_HUMAN_PLAYER_WEAK
			}) as typeof level3;

			expect(target.monster.givenName).to.equal(level3.monster.givenName);
		});
	});

	describe('TARGET_HIGHEST_HP_PLAYER', () => {
		it('gets the target with the highest hp', () => {
			const { playerContestant, level1, level2, level3, contestants } = getContestants();

			playerContestant.monster.hp = 4000;
			level1.monster.hp = 5;
			level2.monster.hp = 5;

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_HIGHEST_HP_PLAYER
			}) as typeof level3;

			expect(target.monster.givenName).to.equal(level3.monster.givenName);
		});

		it('gets the target with the highest current hp', () => {
			const { playerContestant, level1, level2, level3, contestants } = getContestants();

			playerContestant.monster.hp = 4000;
			level1.monster.hp = 5;
			level3.monster.hp = 5;

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_HIGHEST_HP_PLAYER
			}) as typeof level2;

			expect(target.monster.givenName).to.equal(level2.monster.givenName);
		});
	});

	describe('TARGET_HIGHEST_HP_PLAYER_ACCORDING_TO_HANS', () => {
		it('gets the target with the highest hp', () => {
			const { playerContestant, level3, contestants } = getContestants();

			playerContestant.monster.hp = 50001;
			level3.monster.hp = 50000;

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_HIGHEST_HP_PLAYER_ACCORDING_TO_HANS
			}) as typeof playerContestant;

			expect(target.monster.givenName).to.equal(playerContestant.monster.givenName);
		});
	});

	describe('TARGET_MAX_HP_PLAYER', () => {
		it('gets the target with the highest max hp', () => {
			const { playerContestant, contestants } = getContestants();

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_MAX_HP_PLAYER
			}) as typeof playerContestant;

			const opponents = contestants.filter(contestant => contestant !== playerContestant);
			const expectedMaxHp = Math.max(...opponents.map(contestant => contestant.monster.maxHp));

			expect(target.monster.maxHp).to.equal(expectedMaxHp);
		});
	});

	describe('TARGET_MAX_HP_PLAYER_ACCORDING_TO_HANS', () => {
		it('gets the target with the highest max hp', () => {
			const { level3, contestants } = getContestants();

			const target = targetingStrategies.getTarget({
				playerContestant: level3,
				contestants,
				strategy: targetingStrategies.TARGET_MAX_HP_PLAYER_ACCORDING_TO_HANS
			}) as typeof level3;

			// ignoreSelf is false for ACCORDING_TO_HANS, so the player is included
			const expectedMaxHp = Math.max(...contestants.map(c => c.monster.maxHp));
			expect(target.monster.maxHp).to.equal(expectedMaxHp);
		});
	});

	describe('TARGET_PLAYER_WHO_HIT_YOU_LAST', () => {
		it('gets the default target if not yet hit', () => {
			const { playerContestant, contestants } = getContestants();

			const defaultTarget = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_NEXT_PLAYER
			});

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_PLAYER_WHO_HIT_YOU_LAST
			});

			expect((defaultTarget as { monster: { givenName?: string } }).monster.givenName).to.equal('Level 3');
			expect(target).to.equal(defaultTarget);
		});

		it('targets the player who hit you last', async () => {
			const { playerContestant, level1, contestants } = getContestants();

			const hit = new HitCard();

			await playerContestant.monster.hit(1, level1.monster, hit);
			await playerContestant.monster.hit(1, playerContestant.monster, hit);

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_PLAYER_WHO_HIT_YOU_LAST
			}) as typeof level1;

			expect(target.character.givenName).to.equal(level1.character.givenName);
		});
	});

	describe('TARGET_PLAYER_WHO_HIT_YOU_LAST_ACCORDING_TO_HANS', () => {
		it('targets the player who hit you last', async () => {
			const { playerContestant, level3, contestants } = getContestants();

			const hit = new HitCard();

			await playerContestant.monster.hit(1, level3.monster, hit);
			await playerContestant.monster.hit(1, playerContestant.monster, hit);

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_PLAYER_WHO_HIT_YOU_LAST_ACCORDING_TO_HANS
			}) as typeof playerContestant;

			expect(target.character.givenName).to.equal(playerContestant.character.givenName);
		});
	});

	describe('TARGET_PREVIOUS_PLAYER', () => {
		it('gets the previous target in order of play', () => {
			const { playerContestant, level2, contestants } = getContestants();

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_PREVIOUS_PLAYER
			}) as typeof level2;

			expect(target.monster.givenName).to.equal(level2.monster.givenName);
		});
	});

	describe('TARGET_NEXT_PLAYER', () => {
		it('gets the next target in order of play', () => {
			const { playerContestant, level3, contestants } = getContestants();

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_NEXT_PLAYER
			}) as typeof level3;

			expect(target.monster.givenName).to.equal(level3.monster.givenName);
		});

		it('defaults to TARGET_NEXT_PLAYER', () => {
			const { level3: playerContestant, level1, contestants } = getContestants();

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants
			}) as typeof level1;

			expect(target.monster.givenName).to.equal(level1.monster.givenName);
		});
	});
	describe('teams', () => {
		it('prefers a contestant-level team override over the monster and character teams', () => {
			// Ring events set `contestant.team` so they never write to persisted creature
			// options. The override has to win, or the event would have no effect.
			const { playerContestant, level1, level2, level3, contestants } = getContestants();

			playerContestant.monster.team = 'Gryffindor';
			level1.monster.team = 'Gryffindor';
			level2.monster.team = 'Gryffindor';
			level3.monster.team = 'Gryffindor';

			// Everyone shares a monster team, so only the overrides distinguish sides.
			playerContestant.team = 'Red';
			level3.team = 'Red';
			level1.team = 'Blue';
			level2.team = 'Blue';

			const targets = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_ALL_CONTESTANTS
			}) as typeof contestants;

			const names = targets.map(({ monster }) => monster.givenName);
			expect(names).to.not.include(level3.monster.givenName);
			expect(names).to.include(level1.monster.givenName);
			expect(names).to.include(level2.monster.givenName);
		});

		it('falls back to a free-for-all when everyone left is a teammate', () => {
			const { playerContestant, level1, level2, level3, contestants } = getContestants();

			for (const contestant of [playerContestant, level1, level2, level3]) {
				contestant.team = 'Red';
			}

			const targets = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_ALL_CONTESTANTS
			}) as typeof contestants;

			expect(targets.length).to.equal(3);
		});
	});

	describe('TARGET_PREVIOUS_PLAYER', () => {
		it('gets the previous target in order of play', () => {
			const { playerContestant, level2, contestants } = getContestants();

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_PREVIOUS_PLAYER
			}) as typeof level2;

			expect(target.monster.givenName).to.equal(level2.monster.givenName);
		});

		it('wraps around the team-filtered list, not the raw contestant list', () => {
			// Regression: the wraparound used `contestants.length` (unfiltered). In a team
			// fight the filtered list is shorter, so the index ran past the end and the
			// strategy returned `undefined` — a crash waiting to happen mid-fight.
			const { playerContestant, level1, level2, level3, contestants } = getContestants();

			// Filter out everyone but level1, leaving the player at index 0 of the filtered
			// list so the previous index wraps.
			playerContestant.team = 'Red';
			level2.team = 'Blue';
			level3.team = 'Blue';
			level1.team = 'Blue';

			const target = targetingStrategies.getTarget({
				playerContestant,
				contestants,
				strategy: targetingStrategies.TARGET_PREVIOUS_PLAYER
			}) as typeof level1;

			expect(target).to.not.equal(undefined);
			expect(target.monster.givenName).to.be.a('string');
		});
	});
});
