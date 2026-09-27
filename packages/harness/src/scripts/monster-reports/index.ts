import { signatureCardReport } from './signature-cards.js';
import { unicornReport } from './unicorn.js';
import type { MonsterReport } from './types.js';

/** Monsters with their own counters, by creature type; the rest get `signatureCardReport`. */
const REPORTS: Record<string, MonsterReport> = {
	Unicorn: unicornReport,
};

export const reportFor = (creatureType: string): MonsterReport =>
	REPORTS[creatureType] ?? signatureCardReport(creatureType);

export type { MonsterReport } from './types.js';
