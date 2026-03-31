import { randomCharacter } from '../characters/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bossChannel = (..._args: any[]): Promise<any> => Promise.resolve();
const bossChannelName = 'BOSS';

const BOSS_TEAM = 'Boss';

export interface RandomContestantOptions {
	isBoss?: boolean;
	[key: string]: unknown;
}

export interface Contestant {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	monster: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	character: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	channel: (...args: any[]) => Promise<any>;
	channelName: string;
	isBoss?: boolean;
	won?: boolean;
	lost?: boolean;
	fled?: boolean;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	killed?: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	killedBy?: any;
	rounds?: number;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	encounter?: any;
	round?: number;
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
		channel: bossChannel,
		channelName: bossChannelName,
		isBoss
	};
};
