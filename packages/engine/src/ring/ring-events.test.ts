import { expect } from 'chai';

import {
	ALLIANCE_TEAM,
	RING_EVENTS,
	buildRingEventContext,
	getRingEvent,
	selectRingEvent,
	type RingEventContestant,
} from './ring-events.js';
import {
	TARGET_HIGHEST_XP_PLAYER,
	TARGET_HUMAN_PLAYER_WEAK,
	TARGET_RANDOM_PLAYER,
} from '../helpers/targeting-strategies.js';

const boss = (): RingEventContestant => ({ isBoss: true });
const player = (): RingEventContestant => ({});

const eventById = (id: string) => {
	const found = RING_EVENTS.find(event => event.id === id);
	if (!found) throw new Error(`no ring event ${id}`);
	return found;
};

describe('ring/ring-events.ts', () => {
	describe('eligibility', () => {
		it('offers nothing meaningful for a lone player', () => {
			const context = buildRingEventContext([player()]);
			const eligible = RING_EVENTS.filter(event => event.eligible(context));

			// Only the Gauntlet, which is what makes a solo ring interesting at all.
			expect(eligible.map(event => event.id)).to.deep.equal(['gauntlet']);
		});

		it('gates Common Cause on having both players to ally and a boss to ally against', () => {
			const commonCause = eventById('common-cause');

			expect(commonCause.eligible(buildRingEventContext([player(), player()]))).to.equal(false);
			expect(commonCause.eligible(buildRingEventContext([player(), boss()]))).to.equal(false);
			expect(
				commonCause.eligible(buildRingEventContext([player(), player(), boss()]))
			).to.equal(true);
		});

		it('gates House War on enough players to make two warbands', () => {
			const houseWar = eventById('house-war');

			expect(houseWar.eligible(buildRingEventContext([player(), player()]))).to.equal(false);
			expect(
				houseWar.eligible(buildRingEventContext([player(), player(), player()]))
			).to.equal(true);
		});

		it('rejects House War when bosses are present — boss faction cannot be split across houses', () => {
			// In last-team mode the boss faction (userId: 'boss') is its own faction distinct from
			// both houses. After one house is eliminated the surviving boss(es) would still be active,
			// preventing the last-team win condition from ever triggering cleanly. House War is a pure
			// two-house player event; Common Cause is the boss-vs-player team event.
			const houseWar = eventById('house-war');

			// 3 players + 1 boss → ineligible
			expect(
				houseWar.eligible(buildRingEventContext([player(), player(), player(), boss()]))
			).to.equal(false);

			// 3 players, no bosses → eligible
			expect(
				houseWar.eligible(buildRingEventContext([player(), player(), player()]))
			).to.equal(true);
		});

		it('gates The Reckoning on a boss with more than one player to choose between', () => {
			const reckoning = eventById('the-reckoning');

			expect(reckoning.eligible(buildRingEventContext([player(), boss()]))).to.equal(false);
			expect(
				reckoning.eligible(buildRingEventContext([player(), player(), boss()]))
			).to.equal(true);
		});
	});

	describe('selection', () => {
		it('returns undefined when nothing is eligible', () => {
			expect(selectRingEvent(buildRingEventContext([]), 0)).to.equal(undefined);
		});

		it('is deterministic for a given weight offset', () => {
			const context = buildRingEventContext([player(), player(), boss()]);
			const eligible = RING_EVENTS.filter(event => event.eligible(context));

			let cursor = 0;
			for (const expected of eligible) {
				// Land squarely inside this event's slice of the weight range.
				const pick = cursor + expected.weight / 2;
				expect(selectRingEvent(context, pick)?.id).to.equal(expected.id);
				cursor += expected.weight;
			}
		});

		it('accepts a 0–1 fraction as well as an absolute offset', () => {
			const context = buildRingEventContext([player(), player(), boss()]);
			const eligible = RING_EVENTS.filter(event => event.eligible(context));

			expect(selectRingEvent(context, 0)?.id).to.equal(eligible[0].id);
			expect(selectRingEvent(context, 0.999)?.id).to.equal(eligible[eligible.length - 1].id);
		});
	});

	describe('apply', () => {
		it('Common Cause puts every player on one team and leaves bosses alone', () => {
			const contestants = [player(), player(), boss()];

			eventById('common-cause').apply(contestants);

			expect(contestants[0].team).to.equal(ALLIANCE_TEAM);
			expect(contestants[1].team).to.equal(ALLIANCE_TEAM);
			expect(contestants[2].team).to.equal(undefined);
		});

		it('House War splits players across two distinct teams', () => {
			const contestants = [player(), player(), player(), player()];

			eventById('house-war').apply(contestants);

			const teams = contestants.map(contestant => contestant.team);
			expect(teams.every(team => typeof team === 'string')).to.equal(true);
			expect(new Set(teams).size).to.equal(2);
			// Round-robin, so adjacent players end up on opposite sides.
			expect(teams[0]).to.not.equal(teams[1]);
			expect(teams[0]).to.equal(teams[2]);
		});

		it('Blood Feud turns the bosses on each other', () => {
			const contestants = [player(), boss(), boss()];

			expect(eventById('blood-feud').freeForAll).to.equal(true);
			eventById('blood-feud').apply(contestants);

			expect(contestants[1].targetingStrategy).to.equal(TARGET_RANDOM_PLAYER);
			expect(contestants[2].targetingStrategy).to.equal(TARGET_RANDOM_PLAYER);
			expect(contestants[0].targetingStrategy).to.equal(undefined);
		});

		it('The Reckoning points bosses at the highest-XP player', () => {
			const contestants = [player(), player(), boss()];

			eventById('the-reckoning').apply(contestants);

			expect(contestants[2].targetingStrategy).to.equal(TARGET_HIGHEST_XP_PLAYER);
		});

		it('never writes to the underlying monster — overrides stay on the contestant', () => {
			// Persisted creature options must survive a ring event untouched, or a House War
			// would permanently re-sort a player's monster and fight the Sorting Hat scroll.
			const monster = { team: 'Gryffindor', targetingStrategy: TARGET_HUMAN_PLAYER_WEAK };
			const contestants: Array<RingEventContestant & { monster: typeof monster }> = [
				{ monster },
				{ monster },
				{ isBoss: true, monster },
			];

			for (const event of RING_EVENTS) {
				event.apply(contestants);
			}

			expect(monster.team).to.equal('Gryffindor');
			expect(monster.targetingStrategy).to.equal(TARGET_HUMAN_PLAYER_WEAK);
		});
	});

	describe('getRingEvent', () => {
		it('matches on id and on display name, case-insensitively', () => {
			expect(getRingEvent('house-war')?.id).to.equal('house-war');
			expect(getRingEvent('  House War ')?.id).to.equal('house-war');
			expect(getRingEvent('nonsense')).to.equal(undefined);
		});
	});

	describe('victoryMode (Finding 1)', () => {
		it('Common Cause is a last-team event', () => {
			expect(eventById('common-cause').victoryMode).to.equal('last-team');
		});

		it('House War is a last-team event', () => {
			expect(eventById('house-war').victoryMode).to.equal('last-team');
		});

		it('Blood Feud has no victoryMode override — defaults to last-contestant', () => {
			expect(eventById('blood-feud').victoryMode).to.equal(undefined);
		});

		it('Gauntlet has no victoryMode override — defaults to last-contestant', () => {
			expect(eventById('gauntlet').victoryMode).to.equal(undefined);
		});

		it('The Reckoning has no victoryMode override — defaults to last-contestant', () => {
			expect(eventById('the-reckoning').victoryMode).to.equal(undefined);
		});
	});
});
