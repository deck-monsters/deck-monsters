import type { CardCollection } from './card.js';
import type { ItemCollection } from './item.js';

export interface MonsterLike {
	id?: string;
	name?: string;
	type?: string;
	className?: string;
	level?: number;
	stats?: Record<string, unknown>;
	deck?: CardCollection;
	items?: ItemCollection;
	ownerId?: string;
	inRing?: boolean;
	metadata?: Record<string, unknown>;
	[key: string]: unknown;
}

export type MonsterCollection = MonsterLike[];
