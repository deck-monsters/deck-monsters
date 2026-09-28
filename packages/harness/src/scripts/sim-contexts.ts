#!/usr/bin/env node
/**
 * Read the catalogue contexts (roadmap 34 task 6b):
 * `node dist/scripts/sim-contexts.js <contexts-run> <catalogue.json> [--json out.json]`.
 *
 * A card's value in a context is 1 + (its score - a Hit's score) / (a Hit's score - a null's
 * score), all three position-balanced over the nine slots of the same context: Hit-equivalents
 * in that context, where a Hit is 1 and an empty slot is 0. Beside them: its Hit-context sHE
 * and field value from the catalogue (the field is shown, not ranked: its baseline is small). The best context is the highest mean over the measured
 * levels. (The maximum of several noisy values leans high, so a best-context value near a
 * threshold is a question, not a verdict.)
 *
 * A crowd context (more than one opponent) is reported differently: as points gained over a Hit
 * in the same slot. There a Hit over an empty slot is worth only 2-3 points (one strike among
 * four monsters barely moves who survives), so dividing by it blows every value up (a Heal
 * read about 5 Hits). Crowd gains are shown, flagged at 3 points or more, and kept out of the
 * best-context ranking, which is over duels.
 *
 * Flags, per "Value beyond damage" in roadmap 34:
 * - `context card`: its best context is worth at least 0.7 more than the Hit context.
 * - `weak everywhere`: under 0.5 in every duel context and no crowd gain of 3 points, the only
 *   kind of low value that counts.
 * - `trap`: under 0 (worse than an empty slot) in its best context.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { readResults } from '../balance/results.js';
import type { UnitResult } from '../balance/units.js';
import { CARD_CONTEXTS } from '../balance/contexts.js';

const args = process.argv.slice(2);
const jsonIndex = args.indexOf('--json');
const jsonOut = jsonIndex >= 0 ? args[jsonIndex + 1] : undefined;
const positional = jsonIndex >= 0 ? args.filter((_, i) => i !== jsonIndex && i !== jsonIndex + 1) : args;
const [runDir, cataloguePath] = positional;
if (!runDir || !cataloguePath) {
	process.stderr.write('Usage: sim-contexts <contexts-run> <catalogue.json> [--json out.json]\n');
	process.exit(2);
}

interface CatalogueCard {
	cardType: string;
	label: string;
	actionClass: string;
	she: Record<string, number>;
	fieldHe: Record<string, number>;
}
const catalogue = JSON.parse(readFileSync(cataloguePath, 'utf8')) as { cards: CatalogueCard[] };
const results = readResults(runDir).filter(r => !r.error);
const pooled = (rs: UnitResult[]): number => rs.reduce((a, r) => a + r.sides[0]!.score * r.fights, 0) / Math.max(1, rs.reduce((a, r) => a + r.fights, 0));
const contexts = [...new Set(results.map(r => String(r.tags!.context)))];
const levels = [...new Set(results.map(r => Number(r.tags!.level)))].sort((a, b) => a - b);
const mean = (xs: number[]): number => {
	const ok = xs.filter(x => Number.isFinite(x));
	return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : NaN;
};

// Index once: context|level|card -> results.
const byKey = new Map<string, UnitResult[]>();
for (const r of results) {
	const t = r.tags!;
	const card = t.kind === 'context-base' ? `base:${String(t.base)}` : String(t.card);
	const key = `${String(t.context)}|${Number(t.level)}|${card}`;
	(byKey.get(key) ?? byKey.set(key, []).get(key)!).push(r);
}
const base = new Map<string, { hit: number; slope: number }>();
for (const context of contexts) {
	for (const level of levels) {
		const hit = pooled(byKey.get(`${context}|${level}|base:hit`) ?? []);
		const nul = pooled(byKey.get(`${context}|${level}|base:null`) ?? []);
		base.set(`${context}|${level}`, { hit, slope: hit - nul });
	}
}

type Row = { cardType: string; label: string; actionClass: string; hitContext: number; field: number; values: Record<string, Record<number, number>>; means: Record<string, number>; best: string; bestValue: number; flags: string[] };
const rows: Row[] = [];
for (const card of catalogue.cards) {
	const values: Record<string, Record<number, number>> = {};
	const means: Record<string, number> = {};
	for (const context of contexts) {
		values[context] = {};
		for (const level of levels) {
			const rs = byKey.get(`${context}|${level}|${card.cardType}`);
			const b = base.get(`${context}|${level}`)!;
			const crowd = (CARD_CONTEXTS[context]?.opponents ?? 1) > 1;
			if (card.cardType === 'Hit') values[context]![level] = crowd ? 0 : 1;
			else if (rs?.length && crowd) values[context]![level] = 100 * (pooled(rs) - b.hit);
			else if (rs?.length && b.slope > 0) values[context]![level] = 1 + (pooled(rs) - b.hit) / b.slope;
		}
		means[context] = mean(Object.values(values[context]!));
	}
	const hitContext = mean(levels.map(l => card.she[String(l)] ?? NaN));
	const field = mean(levels.map(l => card.fieldHe[String(l)] ?? NaN));
	// The field value is shown but not used for `best`: its baseline is too small to rank on
	// (the catalogue report calls it a direction check only).
	const duels = Object.fromEntries(Object.entries(means).filter(([c]) => (CARD_CONTEXTS[c]?.opponents ?? 1) === 1));
	const all: Record<string, number> = { hits: hitContext, ...duels };
	const [best, bestValue] = Object.entries(all).filter(([, v]) => Number.isFinite(v)).sort((a, b) => b[1] - a[1])[0] ?? ['—', NaN];
	const flags: string[] = [];
	if (Number.isFinite(bestValue)) {
		if (bestValue - hitContext >= 0.7 && best !== 'hits') flags.push(`context card (${best})`);
		const crowdCard = Object.entries(means).some(([c, v]) => (CARD_CONTEXTS[c]?.opponents ?? 1) > 1 && v >= 3);
		// A card that only pays in a crowd is a crowd card, not a weak one.
		if (!crowdCard && Object.values(all).every(v => !Number.isFinite(v) || v < 0.5)) flags.push('weak everywhere');
		if (bestValue < 0) flags.push('trap');
		for (const [c, v] of Object.entries(means)) if ((CARD_CONTEXTS[c]?.opponents ?? 1) > 1 && v >= 3) flags.push(`crowd card (+${v.toFixed(0)} points)`);
	}
	rows.push({ cardType: card.cardType, label: card.label, actionClass: card.actionClass, hitContext, field, values, means, best, bestValue, flags });
}

const fmt = (x: number): string => (Number.isFinite(x) ? x.toFixed(2) : '—');
const lines: string[] = [];
lines.push(`Contexts: ${contexts.join(', ')}; levels ${levels.join(', ')} (each value is the mean over those levels). Baselines, a Hit's score / one Hit's worth over a null (points): ${contexts.map(c => `${c} ${levels.map(l => { const b = base.get(`${c}|${l}`)!; return `L${l} ${(100 * b.hit).toFixed(0)}%/${(100 * b.slope).toFixed(1)}`; }).join(' ')}`).join('; ')}.`, '');
lines.push(`| Card | Class | Hits | Field | ${contexts.map(c => c[0]!.toUpperCase() + c.slice(1) + ((CARD_CONTEXTS[c]?.opponents ?? 1) > 1 ? ' (points)' : '')).join(' | ')} | Best duel | Flags |`);
lines.push(`|${Array(contexts.length + 6).fill('---').join('|')}|`);
for (const r of [...rows].sort((a, b) => a.actionClass.localeCompare(b.actionClass) || b.bestValue - a.bestValue)) {
	lines.push(`| ${r.label} | ${r.actionClass} | ${fmt(r.hitContext)} | ${fmt(r.field)} | ${contexts.map(c => ((CARD_CONTEXTS[c]?.opponents ?? 1) > 1 && Number.isFinite(r.means[c]!) ? `${r.means[c]! >= 0 ? '+' : ''}${r.means[c]!.toFixed(1)}` : fmt(r.means[c]!))).join(' | ')} | ${r.best} ${fmt(r.bestValue)} | ${r.flags.join('; ')} |`);
}
process.stdout.write(`${lines.join('\n')}\n`);
if (jsonOut) writeFileSync(jsonOut, `${JSON.stringify({ contexts, levels, baselines: Object.fromEntries(base), cards: rows }, null, 1)}\n`);
process.exit(0);
