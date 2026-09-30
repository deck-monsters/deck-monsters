#!/usr/bin/env node
/**
 * Roadmap 38: a human against the Gauntlet, shipped rules against the "before" variants.
 *
 * `node dist/scripts/sim-gauntlet.js --variant <name|none|reference> --out result.json
 *   [--fights 1000] [--pair-fights 3000] [--batch 20] [--lone 0,1,3,5] [--pair 1,3] [--ambush 1,3] [--pair-team NAME]`
 * (`--ambush` needs no event, so use it with `--variant none` (shipped) or `no-rivals-outnumbered` (before)).
 *
 * `reference` is the same human(s) against the ring's normal bosses with no event. Any other
 * value is a variant from `balance/variants.ts` (`none` applies nothing, so it measures the shipped rules;
 * `no-rivals-outnumbered` and `event-weights-eligible` are the before) with the Gauntlet
 * forced (`SimConfig.forceRingEvent`), so the extras are spawned by the ring's own rules.
 *
 * Lone human: one row per monster type per level 0/1/3/5, a likely deck, the ring's first
 * boss (level rules as in `sim-rings.ts`), boss type random per batch. Two humans: levels 1
 * and 3, both teamless (so the ring unites them as the Challengers), types random per batch,
 * two ring bosses. Seeds do not depend on the variant, so variants share boss draws.
 */
import '../sim-env.js';
import '../set-env.js';
import { writeFileSync } from 'node:fs';
import { engineReady, getLevel, getXpCapForLevel } from '@deck-monsters/engine';
import { EXTRA_BOSS_LABEL, sideWinRate, simulate, SIM_MONSTER_TYPES, type SimMonsterSpec } from '../simulate.js';
import { applyVariants } from '../balance/variants.js';
import { mulberry32 } from '../rng.js';

const arg = (name: string, fallback: string): string => {
	const i = process.argv.indexOf(`--${name}`);
	return i >= 0 ? process.argv[i + 1]! : fallback;
};
const VARIANT = arg('variant', 'none');
const OUT = arg('out', 'gauntlet.json');
const FIGHTS = Number(arg('fights', '1000'));
const PAIR_FIGHTS = Number(arg('pair-fights', '3000'));
const BATCH = Number(arg('batch', '20'));
// Which cells this process runs. A long run leaks memory (about 2.5 GB per 12,000 fights, and
// five at once swapped a 16 GB box to a crawl), so the driver runs a few levels per process.
const LONE_LEVELS = arg('lone', '0,1,3,5').split(',').filter(Boolean).map(Number);
// Ambush cells: one human against a boss and an ambush minion (a third of its HP), no event.
const AMBUSH_LEVELS = arg('ambush', '').split(',').filter(Boolean).map(Number);
// `--pair-team Reds` puts both humans of a pair cell on that team (else they are teamless).
const PAIR_TEAM = arg('pair-team', '');
const PAIR_LEVELS = arg('pair', '1,3').split(',').filter(Boolean).map(Number);

/** Boss levels as the ring picks them (see `sim-rings.ts`): XP evenly up to the cap's XP. */
function bossLevels(humanLevels: number[], count: number, pick: () => number): number[] {
	const ceiling = Math.max(...humanLevels) + 1;
	const average = Math.floor(humanLevels.reduce((a, b) => a + b, 0) / humanLevels.length);
	let budget = humanLevels.reduce((a, b) => a + b, 0) + 1;
	const levels: number[] = [];
	for (let b = 0; b < count; b += 1) {
		const banded = pick() < 0.35 ? ceiling : average;
		const cap = Math.max(0, Math.min(banded, ceiling, budget));
		const level = getLevel(Math.floor(pick() * (getXpCapForLevel(cap) + 1)));
		budget -= level;
		levels.push(level);
	}
	return levels;
}

interface Cell {
	humans: number;
	kind: 'gauntlet' | 'ambush';
	level: number;
	type: string;
	fights: number;
	humanWins: number;
	draws: number;
	/** Fights the Gauntlet actually fired in (should equal `fights` unless `reference`). */
	gauntlets: number;
	extraBossWins: number;
	avgRounds: number;
	/** The team both humans of a pair cell shared, if any. */
	pairTeam?: string;
}

async function cell(humans: number, level: number, typeIndex: number | null, seedBase: number, fights: number, ambush = false): Promise<Cell> {
	const isReference = VARIANT === 'reference' || ambush;
	let wins = 0;
	let draws = 0;
	let extra = 0;
	let fired = 0;
	let rounds = 0;
	let done = 0;
	const batches = Math.ceil(fights / BATCH);
	for (let b = 0; b < batches; b += 1) {
		const pick = mulberry32(seedBase + b * 7919);
		const n = Math.min(BATCH, fights - done);
		const anyType = () => SIM_MONSTER_TYPES[Math.floor(pick() * SIM_MONSTER_TYPES.length)]!;
		const humanSpecs: SimMonsterSpec[] = Array.from({ length: humans }, (_, i) => ({
			type: typeIndex !== null && i === 0 ? SIM_MONSTER_TYPES[typeIndex]! : anyType(),
			level,
			role: 'human' as const,
			deckStyle: 'likely' as const,
			...(humans === 2 && PAIR_TEAM ? { sharedTeam: PAIR_TEAM } : {}),
		}));
		const bosses: SimMonsterSpec[] = bossLevels(new Array(humans).fill(level), ambush ? 2 : humans, pick).map((l, i) => ({
			type: anyType(),
			level: l,
			role: 'boss' as const,
			...(ambush && i === 1 ? { minion: true } : {}),
		}));
		const res = await simulate({
			monsters: [...humanSpecs, ...bosses],
			fights: n,
			seed: seedBase + b * 104729,
			roomId: `gauntlet-${seedBase}-${b}`,
			...(isReference ? {} : { forceRingEvent: 'gauntlet' }),
		});
		wins += (sideWinRate(res, humanSpecs.map((_, i) => `Sim ${i + 1}`)) / 100) * n;
		draws += (res.drawRate / 100) * n;
		// A boss the Gauntlet added is no sim slot, so its wins are in `winnersByFight` only.
		extra += res.winnersByFight.filter(w => w.includes(EXTRA_BOSS_LABEL)).length;
		fired += res.ringEvents['The Gauntlet'] ?? 0;
		rounds += res.avgRounds * n;
		done += n;
	}
	return {
		humans,
		kind: ambush ? 'ambush' : 'gauntlet',
		level,
		type: typeIndex === null ? 'mixed' : SIM_MONSTER_TYPES[typeIndex]!,
		fights: done,
		humanWins: Math.round(wins),
		draws: Math.round(draws),
		gauntlets: fired,
		extraBossWins: Math.round(extra),
		avgRounds: rounds / done,
		...(humans === 2 && PAIR_TEAM ? { pairTeam: PAIR_TEAM } : {}),
	};
}

async function main(): Promise<void> {
	await engineReady;
	const undo = VARIANT === 'none' || VARIANT === 'reference' ? () => {} : applyVariants([VARIANT]);
	const cells: Cell[] = [];
	try {
		for (const level of LONE_LEVELS) {
			for (let t = 0; t < SIM_MONSTER_TYPES.length; t += 1) {
				cells.push(await cell(1, level, t, 100_000 + level * 10_007 + t * 1009, FIGHTS));
				process.stderr.write(`${VARIANT} lone L${level} ${SIM_MONSTER_TYPES[t]} ${cells.at(-1)!.humanWins}/${FIGHTS}\n`);
			}
		}
		for (const level of AMBUSH_LEVELS) {
			for (let t = 0; t < SIM_MONSTER_TYPES.length; t += 1) {
				cells.push(await cell(1, level, t, 500_000 + level * 10_007 + t * 1009, FIGHTS, true));
				process.stderr.write(`${VARIANT} ambush L${level} ${SIM_MONSTER_TYPES[t]} ${cells.at(-1)!.humanWins}/${FIGHTS}\n`);
			}
		}
		for (const level of PAIR_LEVELS) {
			// Types are drawn per batch, so this is one mixed cell.
			const c = await cell(2, level, null, 900_000 + level * 10_007, PAIR_FIGHTS);
			cells.push(c);
			process.stderr.write(`${VARIANT} pair L${level} ${c.humanWins}/${c.fights}\n`);
		}
	} finally {
		undo();
	}
	writeFileSync(
		OUT,
		JSON.stringify({ variant: VARIANT, fightsPerCell: FIGHTS, pairFights: PAIR_FIGHTS, batch: BATCH, types: SIM_MONSTER_TYPES, cells }, null, 1),
	);
	process.exit(0);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
