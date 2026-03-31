import type { MonsterCollection } from './monster.js';

export interface RingBattleLike {
	id?: string;
	startedAt?: string | number | Date;
	finishedAt?: string | number | Date;
	winnerId?: string;
	metadata?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface RingLike {
	monsters?: MonsterCollection;
	battles?: RingBattleLike[];
	status?: string;
	encounterIntervalMs?: number;
	metadata?: Record<string, unknown>;
	[key: string]: unknown;
}
