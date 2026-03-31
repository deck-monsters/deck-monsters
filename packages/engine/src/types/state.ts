import type { CharacterLike } from './character.js';
import type { RingLike } from './ring.js';

export type SerializedState = string;

export interface GameStateLike {
	createdAt?: string | number | Date;
	updatedAt?: string | number | Date;
	version?: string;
	characters?: CharacterLike[];
	ring?: RingLike;
	options?: Record<string, unknown>;
	metadata?: Record<string, unknown>;
	[key: string]: unknown;
}
