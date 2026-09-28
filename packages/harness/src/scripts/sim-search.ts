#!/usr/bin/env node
/**
 * Layer 4, lean (roadmap 34 task 9): search each monster's best 9-card hand and order from
 * what a typical player owns, against the field of every other monster's current best hand,
 * then play the final hands against each other on fresh seeds (the band check).
 *
 *   node dist/scripts/sim-search.js --out <dir> --collection <layer3-collection.json>
 *     [--levels 1,3,5] [--rounds 2] [--max-steps 10] [--moves 16] [--fights 20]
 *     [--matrix-fights 100] [--workers 4] [--max-hours 10]
 *
 * A standalone black box like the runner: no network, state written after every phase, and a
 * rerun with the same arguments resumes (each phase is a runner plan in its own directory,
 * so a killed phase keeps its finished units). `--max-hours` stops cleanly between phases.
 *
 * Method (a lean cut of Layer 4 in roadmap 34):
 * - **Pool.** The cards the typical player owns at that level (the collection model: cards at
 *   least half of players hold, at their typical copy count, at most 4), plus Hits.
 * - **Start.** Round 1 starts every monster from its typical hand in the collection model.
 * - **Step.** For every monster at once: the current hand and `--moves` random moves (a card
 *   swapped for one from the pool, or two slots swapped), each against every other monster's
 *   current hand, seat-swapped, on the same search seeds. Phase A scores them; the best move
 *   whose paired gain clears 99% (one-sided) goes to phase B, which replays it against the
 *   current hand on fresh seeds and keeps it only if the gain holds (95%). A search ends
 *   after 2 steps in a row with nothing kept, or `--max-steps`.
 * - **Rounds.** Round 2 repeats the search against the round-1 hands (best response), and
 *   reports whether hands still changed.
 * - **Matrix.** The final hands, every pair, on validation seeds the search never used, plus
 *   each final hand against its own typical starting hand (what good picks are worth).
 */
import '../sim-env.js';
import '../set-env.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { engineReady } from '@deck-monsters/engine';
import { runPlan } from '../balance/runner.js';
import { finishedIds, readResults } from '../balance/results.js';
import { SIM_MONSTER_TYPES } from '../simulate.js';
import { mulberry32 } from '../rng.js';
import type { Plan, Unit, UnitResult } from '../balance/units.js';

function arg(name: string, fallback: string): string {
	const i = process.argv.indexOf(name);
	return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const out = arg('--out', '');
const collectionPath = arg('--collection', '');
const levels = arg('--levels', '1,3,5').split(',').map(Number);
const rounds = Number(arg('--rounds', '2'));
const maxSteps = Number(arg('--max-steps', '10'));
const moves = Number(arg('--moves', '16'));
const fights = Number(arg('--fights', '20'));
const matrixFights = Number(arg('--matrix-fights', '100'));
const workers = Number(arg('--workers', '4'));
const maxHours = Number(arg('--max-hours', '10'));
const MAX_COPIES = 4;

interface Search {
	type: string;
	level: number;
	hand: string[];
	start: string[];
	pool: Record<string, number>;
	idle: number;
	done: boolean;
	history: Array<{ round: number; step: number; move: string; gain: number; confirmed: number }>;
}
interface State {
	round: number;
	step: number;
	phase: 'A' | 'B' | 'matrix' | 'finished';
	searches: Record<string, Search>;
	/** Hands of the field each round searches against (round -> key -> hand). */
	fields: Record<number, Record<string, string[]>>;
	/** Phase B candidates for the current step (key -> hand). */
	pending: Record<string, { hand: string[]; move: string; gain: number }>;
	changedInRound: Record<number, number>;
}

const key = (type: string, level: number): string => `${type}@L${level}`;
const statePath = (): string => join(out, 'search-state.json');
const save = (state: State): void => writeFileSync(statePath(), `${JSON.stringify(state, null, 1)}\n`);

interface CollectionJson {
	monsters: Record<string, Record<string, { typicalHand: string[]; cards: Array<{ card: string; meanCopies: number; share: number }> }>>;
}

function initialState(): State {
	const collection = JSON.parse(readFileSync(collectionPath, 'utf8')) as CollectionJson;
	const searches: Record<string, Search> = {};
	for (const type of SIM_MONSTER_TYPES) {
		for (const level of levels) {
			const entry = collection.monsters[type]?.[String(level)];
			if (!entry) throw new Error(`No collection entry for ${type} at level ${level}; run sim:collection with this level`);
			const pool: Record<string, number> = { Hit: MAX_COPIES };
			for (const c of entry.cards) if (c.share >= 0.5) pool[c.card] = Math.min(MAX_COPIES, Math.max(pool[c.card] ?? 0, Math.round(c.meanCopies), 1));
			const hand = [...entry.typicalHand];
			while (hand.length < 9) hand.push('Hit');
			searches[key(type, level)] = { type, level, hand: hand.slice(0, 9), start: hand.slice(0, 9), pool, idle: 0, done: false, history: [] };
		}
	}
	return { round: 1, step: 1, phase: 'A', searches, fields: {}, pending: {}, changedInRound: {} };
}

const counts = (hand: string[]): Map<string, number> => {
	const m = new Map<string, number>();
	for (const c of hand) m.set(c, (m.get(c) ?? 0) + 1);
	return m;
};

/** Random legal moves from `hand`, reproducible from the seed. */
function proposeMoves(s: Search, seed: number): Array<{ hand: string[]; move: string }> {
	const rand = mulberry32(seed);
	const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)]!;
	const seen = new Set<string>([s.hand.join('|')]);
	const outMoves: Array<{ hand: string[]; move: string }> = [];
	const poolCards = Object.keys(s.pool);
	for (let tries = 0; outMoves.length < moves && tries < moves * 20; tries += 1) {
		const hand = [...s.hand];
		let move: string;
		if (rand() < 0.65) {
			const slot = Math.floor(rand() * 9);
			const card = pick(poolCards);
			if (card === hand[slot]) continue;
			hand[slot] = card;
			if ((counts(hand).get(card) ?? 0) > s.pool[card]!) continue;
			move = `slot ${slot + 1}: ${s.hand[slot]} -> ${card}`;
		} else {
			const a = Math.floor(rand() * 9);
			const b = Math.floor(rand() * 9);
			if (a === b || hand[a] === hand[b]) continue;
			[hand[a], hand[b]] = [hand[b]!, hand[a]!];
			move = `swap slots ${a + 1} and ${b + 1}`;
		}
		if (seen.has(hand.join('|'))) continue;
		seen.add(hand.join('|'));
		outMoves.push({ hand, move });
	}
	return outMoves;
}

/** Units: `hand` of `s` against every other monster's field hand at the same level. */
function vsField(s: Search, field: Record<string, string[]>, hand: string[], id: string, seedBase: number, tags: Record<string, string | number>): Unit[] {
	return SIM_MONSTER_TYPES.filter(t => t !== s.type).map((opp, i) => ({
		id: `${id}:vs:${opp}`,
		sides: [
			{ type: s.type, level: s.level, deck: hand },
			{ type: opp, level: s.level, deck: field[key(opp, s.level)]! },
		],
		fights,
		// Same seed for every hand of this search against this opponent: paired comparisons.
		seed: seedBase + i * 104_729,
		tags: { ...tags, opponent: opp },
	}));
}

const meanScore = (rs: UnitResult[]): { mean: number; n: number } => {
	const n = rs.reduce((a, r) => a + r.fights, 0);
	return { mean: rs.reduce((a, r) => a + r.sides[0]!.score * r.fights, 0) / Math.max(1, n), n };
};
/** One-sided z for a paired gain of `b` over `a` (binomial variance; conservative with draws). */
const zGain = (a: { mean: number; n: number }, b: { mean: number; n: number }): number => {
	const v = (a.mean * (1 - a.mean)) / Math.max(1, a.n) + (b.mean * (1 - b.mean)) / Math.max(1, b.n);
	return (b.mean - a.mean) / Math.sqrt(Math.max(v, 1e-9));
};

async function runPhase(name: string, units: Unit[]): Promise<UnitResult[]> {
	const dir = join(out, name);
	const plan: Plan = { name: `search ${name}`, profile: 'quick', units };
	await runPlan(plan, { outDir: dir, workers });
	// Every unit must succeed before the state moves on: a failed unit (a cancelled fight, say)
	// stays unfinished in this phase's directory, and the phase would never be revisited once
	// the state advanced, leaving move choices or the matrix on missing samples (a Codex review
	// of #409). Throwing keeps the state on this phase; a rerun retries only the failed units.
	const done = finishedIds(dir);
	const missing = units.filter(u => !done.has(u.id));
	if (missing.length) {
		throw new Error(`${missing.length} of ${units.length} units in ${name} did not finish (first: ${missing[0]!.id}); rerun the same command to retry them`);
	}
	const results = readResults(dir).filter(r => !r.error);
	// A unit retried after a failure has two lines; keep the successful one.
	return [...new Map(results.map(r => [r.id, r])).values()];
}

async function main(): Promise<void> {
	if (!out || !collectionPath) {
		process.stderr.write('Usage: sim-search --out <dir> --collection <layer3-collection.json> [options]\n');
		process.exit(2);
	}
	await engineReady;
	mkdirSync(out, { recursive: true });
	const state: State = existsSync(statePath()) ? (JSON.parse(readFileSync(statePath(), 'utf8')) as State) : initialState();
	save(state);
	const started = Date.now();
	const log = (line: string): void => {
		process.stdout.write(`${new Date().toISOString()} ${line}\n`);
	};

	while (state.phase !== 'finished') {
		if ((Date.now() - started) / 3_600_000 > maxHours) {
			log(`Stopping at --max-hours ${maxHours}; rerun the same command to resume.`);
			break;
		}
		const tag = `r${state.round}s${state.step}`;
		if (state.phase === 'A') {
			state.fields[state.round] ??= Object.fromEntries(Object.entries(state.searches).map(([k, s]) => [k, [...s.hand]]));
			const field = state.fields[state.round]!;
			const active = Object.entries(state.searches).filter(([, s]) => !s.done);
			if (!active.length || state.step > maxSteps) {
				const changed = Object.values(state.searches).filter(s => s.history.some(h => h.round === state.round)).length;
				state.changedInRound[state.round] = changed;
				log(`Round ${state.round} finished: ${changed} of ${Object.keys(state.searches).length} hands changed.`);
				if (state.round >= rounds) state.phase = 'matrix';
				else {
					state.round += 1;
					state.step = 1;
					for (const s of Object.values(state.searches)) {
						s.done = false;
						s.idle = 0;
					}
				}
				save(state);
				continue;
			}
			const units: Unit[] = [];
			const proposals: Record<string, Array<{ hand: string[]; move: string }>> = {};
			active.forEach(([k, s], si) => {
				const seedBase = 1_000_003 * state.round + 10_007 * state.step + 101 * si;
				proposals[k] = proposeMoves(s, seedBase);
				units.push(...vsField(s, field, s.hand, `${tag}:${k}:current`, seedBase, { search: k, cand: -1 }));
				proposals[k]!.forEach((p, ci) => units.push(...vsField(s, field, p.hand, `${tag}:${k}:c${ci}`, seedBase, { search: k, cand: ci })));
			});
			log(`Round ${state.round} step ${state.step} phase A: ${active.length} searches, ${units.length} units.`);
			const results = await runPhase(`${tag}-A`, units);
			state.pending = {};
			for (const [k] of active) {
				const mine = results.filter(r => r.tags?.search === k);
				const current = meanScore(mine.filter(r => r.tags!.cand === -1));
				let best: { ci: number; z: number; gain: number } | undefined;
				proposals[k]!.forEach((_, ci) => {
					const cand = meanScore(mine.filter(r => r.tags!.cand === ci));
					const z = zGain(current, cand);
					if (z > 2.326 && (!best || cand.mean - current.mean > best.gain)) best = { ci, z, gain: cand.mean - current.mean };
				});
				if (best) state.pending[k] = { hand: proposals[k]![best.ci]!.hand, move: proposals[k]![best.ci]!.move, gain: best.gain };
				else {
					const s = state.searches[k]!;
					s.idle += 1;
					if (s.idle >= 2) s.done = true;
				}
			}
			state.phase = 'B';
			save(state);
		} else if (state.phase === 'B') {
			const field = state.fields[state.round]!;
			const units: Unit[] = [];
			Object.entries(state.pending).forEach(([k, p], i) => {
				const s = state.searches[k]!;
				// Fresh seeds, never used in phase A.
				const seedBase = 7_000_001 + 1_000_003 * state.round + 10_007 * state.step + 101 * i;
				units.push(...vsField(s, field, s.hand, `${tag}:${k}:confirm-current`, seedBase, { search: k, cand: -1 }));
				units.push(...vsField(s, field, p.hand, `${tag}:${k}:confirm-move`, seedBase, { search: k, cand: 0 }));
			});
			log(`Round ${state.round} step ${state.step} phase B: confirming ${Object.keys(state.pending).length} moves.`);
			const results = units.length ? await runPhase(`${tag}-B`, units) : [];
			for (const [k, p] of Object.entries(state.pending)) {
				const s = state.searches[k]!;
				const mine = results.filter(r => r.tags?.search === k);
				const current = meanScore(mine.filter(r => r.tags!.cand === -1));
				const moved = meanScore(mine.filter(r => r.tags!.cand === 0));
				if (zGain(current, moved) > 1.645) {
					s.hand = p.hand;
					s.idle = 0;
					s.history.push({ round: state.round, step: state.step, move: p.move, gain: p.gain, confirmed: moved.mean - current.mean });
					log(`  ${k}: kept ${p.move} (+${(100 * (moved.mean - current.mean)).toFixed(1)} points on fresh seeds)`);
				} else {
					s.idle += 1;
					if (s.idle >= 2) s.done = true;
					log(`  ${k}: ${p.move} did not hold on fresh seeds`);
				}
			}
			state.pending = {};
			state.step += 1;
			state.phase = 'A';
			save(state);
		} else if (state.phase === 'matrix') {
			const units: Unit[] = [];
			let seed = 55_000_001;
			for (const level of levels) {
				for (let i = 0; i < SIM_MONSTER_TYPES.length; i += 1) {
					const a = state.searches[key(SIM_MONSTER_TYPES[i]!, level)]!;
					for (let j = i + 1; j < SIM_MONSTER_TYPES.length; j += 1) {
						const b = state.searches[key(SIM_MONSTER_TYPES[j]!, level)]!;
						seed += 7919;
						units.push({ id: `matrix:L${level}:${a.type}:${b.type}`, sides: [{ type: a.type, level, deck: a.hand }, { type: b.type, level, deck: b.hand }], fights: matrixFights, seed, tags: { kind: 'matrix', level, a: a.type, b: b.type } });
					}
					seed += 7919;
					units.push({ id: `skill:L${level}:${a.type}`, sides: [{ type: a.type, level, deck: a.hand }, { type: a.type, level, deck: a.start }], fights: matrixFights, seed, tags: { kind: 'skill', level, a: a.type } });
				}
			}
			log(`Matrix: ${units.length} units on validation seeds.`);
			await runPhase('matrix', units);
			state.phase = 'finished';
			save(state);
			log(`Finished. Read it with: node dist/scripts/sim-search-report.js ${out}`);
		}
	}
	process.exit(0);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
