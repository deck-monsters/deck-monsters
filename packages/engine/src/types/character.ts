import type { ItemCollection } from './item.js';
import type { MonsterCollection } from './monster.js';

export interface CharacterInfo {
	id?: string;
	name?: string;
	type?: string;
	icon?: string;
	gender?: string;
	metadata?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface CharacterLike extends CharacterInfo {
	level?: number;
	coins?: number;
	xp?: number;
	monsters?: MonsterCollection;
	inventory?: ItemCollection;
}

export interface CharacterActions {
	spawnMonster?: (...args: unknown[]) => unknown;
	equipMonster?: (...args: unknown[]) => unknown;
	sendToRing?: (...args: unknown[]) => unknown;
	explore?: (...args: unknown[]) => unknown;
	lookAtCharacter?: (...args: unknown[]) => unknown;
	rankings?: (...args: unknown[]) => unknown;
	buy?: (...args: unknown[]) => unknown;
	sell?: (...args: unknown[]) => unknown;
	[key: string]: unknown;
}
