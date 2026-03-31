export interface ItemLike {
	id?: string;
	name?: string;
	slug?: string;
	type?: string;
	rarity?: string;
	cost?: number;
	effect?: unknown;
	metadata?: Record<string, unknown>;
	[key: string]: unknown;
}

export type ItemCollection = ItemLike[];
