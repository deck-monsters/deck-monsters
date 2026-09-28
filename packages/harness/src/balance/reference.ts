/**
 * The reference chassis (roadmap 34, "Vocabulary"): a harness-only body with the median stats
 * of the seven real monsters, no creature type, and fixed HP and AC variance, so a card's
 * value can be measured apart from the body holding it. It is a real monster instance (the
 * engine needs one) with its stat offsets, variances, and creature type overridden.
 */
import { allMonsters } from '@deck-monsters/engine';
import { mulberry32 } from '../rng.js';

export const REFERENCE_CREATURE_TYPE = 'Reference';

interface Offsets {
	dexModifier: number;
	strModifier: number;
	intModifier: number;
	/** Total HP and AC variance (instance roll plus any per-type constant). */
	hpVariance: number;
	acVariance: number;
}

type MonsterInstance = {
	options: Record<string, unknown>;
	hpVariance: number;
	acVariance: number;
	setOptions(options: Record<string, unknown>): void;
	disposeTimers(): void;
	constructor: { hpVariance?: number; acVariance?: number };
};

const median = (xs: number[]): number => {
	const s = [...xs].sort((a, b) => a - b);
	const mid = Math.floor(s.length / 2);
	return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

let cached: Offsets | undefined;

/**
 * Median stat offsets of the real monsters, and the median of their total HP and AC variance
 * over many instances. Computed once, on its own fixed seed: it must not draw from a fight's
 * seeded `Math.random`, or a unit's result would depend on which unit ran first in the
 * process.
 */
export function referenceOffsets(): Offsets {
	if (cached) return cached;
	const previous = Math.random;
	Math.random = mulberry32(34_034);
	try {
		cached = computeOffsets();
	} finally {
		Math.random = previous;
	}
	return cached;
}

function computeOffsets(): Offsets {
	const classes = allMonsters as unknown as Array<new (options?: Record<string, unknown>) => MonsterInstance>;
	const perType = classes.map(M => new M({ name: 'reference-probe' }));
	const variances = classes.flatMap(M => Array.from({ length: 50 }, () => new M({ name: 'reference-probe' })));
	try {
		return {
			dexModifier: median(perType.map(m => Number(m.options.dexModifier ?? 0))),
			strModifier: median(perType.map(m => Number(m.options.strModifier ?? 0))),
			intModifier: median(perType.map(m => Number(m.options.intModifier ?? 0))),
			hpVariance: Math.round(median(variances.map(m => m.hpVariance))),
			acVariance: Math.round(median(variances.map(m => m.acVariance))),
		};
	} finally {
		// Every creature starts a passive-healing timer; these probes never enter a ring, so
		// nothing else would stop them (a Codex review of #408).
		for (const m of [...perType, ...variances]) m.disposeTimers();
	}
}

/** Turn a freshly built monster into the reference chassis, in place. */
export function applyReferenceChassis(monster: MonsterInstance): void {
	const o = referenceOffsets();
	const staticHp = monster.constructor.hpVariance ?? 0;
	const staticAc = monster.constructor.acVariance ?? 0;
	monster.setOptions({
		dexModifier: o.dexModifier,
		strModifier: o.strModifier,
		intModifier: o.intModifier,
		hpVariance: o.hpVariance - staticHp,
		acVariance: o.acVariance - staticAc,
	});
	// No creature type: no card is strong or weak against the reference chassis.
	Object.defineProperty(monster, 'creatureType', { value: REFERENCE_CREATURE_TYPE, configurable: true });
	(monster as unknown as { hp: number; maxHp: number }).hp = (monster as unknown as { maxHp: number }).maxHp;
}
