import { randomCharacter } from '../characters/index.js';
import type { Contestant } from '../ring/index.js';

const BOSS_USER_ID = 'boss';
const BOSS_TEAM = 'Boss';

export interface RandomContestantOptions {
	isBoss?: boolean;
	[key: string]: unknown;
}

export const randomContestant = ({
	isBoss = true,
	...options
}: RandomContestantOptions = {}): Contestant => {
	let team: string | undefined;
	if (isBoss) team = BOSS_TEAM;

	const character = randomCharacter({ isBoss, team, ...options });
	const monster = character.monsters[0];

	return {
		monster,
		character,
		userId: BOSS_USER_ID,
		isBoss
	};
};
