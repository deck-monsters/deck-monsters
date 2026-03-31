export interface CardLike {
	id?: string;
	name?: string;
	slug?: string;
	className?: string;
	cardClass?: string;
	level?: number;
	cost?: number;
	cooldown?: number;
	text?: string;
	metadata?: Record<string, unknown>;
	[key: string]: unknown;
}

export type CardCollection = CardLike[];
