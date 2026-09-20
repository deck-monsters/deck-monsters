import { expect } from 'chai';

import {
	formatGlobalMonsterLeaderboard,
	formatRoomMonsterLeaderboard,
} from './analytics-queries.js';

const monsterRows = [
	{
		monsterId: 'monster-1',
		displayName: 'Stonefang',
		ownerName: 'Saffron',
		monsterType: 'Basilisk',
		xp: 42,
		level: 3,
		wins: 2,
		losses: 1,
		winRate: 2 / 3,
	},
] as any;

describe('formatted monster leaderboards', () => {
	it('uses the canonical Lvl badge in room and global output', () => {
		expect(formatRoomMonsterLeaderboard('Room', monsterRows)).to.include('42 XP Lvl 3');
		expect(formatGlobalMonsterLeaderboard('Global', monsterRows)).to.include('42 XP Lvl 3');
	});
});
