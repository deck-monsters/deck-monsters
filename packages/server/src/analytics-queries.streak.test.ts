import { expect } from 'chai';

import type { FightSummaryRow } from './analytics-queries.js';
import { winStreakFromRecentFights } from './analytics-queries.js';

function p(
	monsterId: string,
	outcome: 'win' | 'loss' | 'draw' | 'fled' | 'permaDeath'
): FightSummaryRow['participants'][0] {
	return {
		monsterId,
		monsterName: monsterId,
		monsterType: 'T',
		ownerUserId: 'u',
		ownerDisplayName: 'U',
		outcome,
		xpGained: 0,
		level: 1,
	};
}

describe('winStreakFromRecentFights', () => {
	it('counts consecutive wins from most recent', () => {
		const fights: FightSummaryRow[] = [
			{
				id: 1,
				roomId: 'r',
				fightNumber: 5,
				startedAt: new Date(),
				endedAt: new Date(),
				outcome: 'win',
				winnerMonsterId: 'a',
				winnerMonsterName: 'A',
				winnerOwnerUserId: null,
				loserMonsterId: 'b',
				loserMonsterName: 'B',
				loserOwnerUserId: null,
				roundCount: 1,
				winnerXpGained: 0,
				loserXpGained: 0,
				cardDropName: null,
				participants: [p('a', 'win'), p('b', 'loss')],
			},
			{
				id: 2,
				roomId: 'r',
				fightNumber: 4,
				startedAt: new Date(),
				endedAt: new Date(),
				outcome: 'win',
				winnerMonsterId: 'a',
				winnerMonsterName: 'A',
				winnerOwnerUserId: null,
				loserMonsterId: 'b',
				loserMonsterName: 'B',
				loserOwnerUserId: null,
				roundCount: 1,
				winnerXpGained: 0,
				loserXpGained: 0,
				cardDropName: null,
				participants: [p('a', 'win'), p('b', 'loss')],
			},
			{
				id: 3,
				roomId: 'r',
				fightNumber: 3,
				startedAt: new Date(),
				endedAt: new Date(),
				outcome: 'win',
				winnerMonsterId: 'b',
				winnerMonsterName: 'B',
				winnerOwnerUserId: null,
				loserMonsterId: 'a',
				loserMonsterName: 'A',
				loserOwnerUserId: null,
				roundCount: 1,
				winnerXpGained: 0,
				loserXpGained: 0,
				cardDropName: null,
				participants: [p('b', 'win'), p('a', 'loss')],
			},
		];
		expect(winStreakFromRecentFights(fights, 'a')).to.equal(2);
		expect(winStreakFromRecentFights(fights, 'b')).to.equal(0);
	});
});
