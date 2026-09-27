#!/usr/bin/env node
/**
 * Realistic rings: `node dist/scripts/sim-rings.js` (Pass B, docs/archive/roadmap/31-pass-b-rings-and-bosses.md).
 *
 * Two reports, both with human contestants (a player's starting deck plus fills per level,
 * not the boss decks every earlier report used):
 *
 * 1. **Class curves.** Each monster, as a human, against a random other monster at the same
 *    level, at levels 1-20. The balance target is a curve per class: casters (Cleric, Bard,
 *    Wizard) start fragile and grow strong; brutes (Barbarian, Fighter) the other way.
 * 2. **Sampled rings.** Rings drawn the way rooms fill: mostly two or three monsters, now and
 *    then up to eight; humans of mixed levels (mostly 0-6); sometimes two of them on a team;
 *    and in some rings bosses, spawned by the ring's own rules (one per human at up to the
 *    strongest human + 1, within the level budget). Prints each monster's share of wins
 *    against its fair share, and how often humans beat the bosses.
 *
 * `SIM_RINGS_FIGHTS` sets fights per batch (default 20). Run manually (not in CI).
 */

import '../sim-env.js';
import '../set-env.js';
import { allMonsters, engineReady, getLevel, getXpCapForLevel } from '@deck-monsters/engine';
import { simulate, SIM_MONSTER_TYPES, type SimMonsterSpec } from '../simulate.js';
import { mulberry32 } from '../rng.js';

const FIGHTS = Number(process.env.SIM_RINGS_FIGHTS ?? 20);
const CURVE_LEVELS = [1, 3, 5, 10, 15, 20];
const CURVE_BATCHES = 6;
const SAMPLED_RINGS = 120;

const classOf = (type: string): string =>
	(allMonsters.find(M => (M as unknown as { name: string }).name === type) as unknown as { class: string }).class;

/** Weighted pick from [value, weight] pairs. */
const weighted = <T>(pick: () => number, table: Array<[T, number]>): T => {
	const total = table.reduce((sum, [, w]) => sum + w, 0);
	let roll = pick() * total;
	for (const [value, w] of table) {
		roll -= w;
		if (roll < 0) return value;
	}
	return table[table.length - 1]![0];
};

// Until telemetry says otherwise: rooms are small, and most monsters are early levels
// (level 5 takes about 38 wins, level 10 about 445).
const RING_SIZES: Array<[number, number]> = [[2, 45], [3, 25], [4, 12], [5, 8], [6, 5], [8, 5]];
const HUMAN_LEVELS: Array<[number, number]> = [[0, 10], [1, 20], [2, 18], [3, 15], [4, 12], [5, 10], [6, 7], [8, 5], [10, 3]];

async function classCurves(): Promise<void> {
	process.stdout.write(`\n=== Class curves: each monster as a human vs a random other monster, same level (${CURVE_BATCHES} × ${FIGHTS} fights per cell) ===\n`);
	process.stdout.write(`${'monster'.padEnd(14)}${'class'.padEnd(11)}${CURVE_LEVELS.map(l => `L${l}`.padStart(7)).join('')}\n`);
	let seed = 5003;
	for (const type of SIM_MONSTER_TYPES) {
		const cells: string[] = [];
		for (const level of CURVE_LEVELS) {
			const pick = mulberry32((seed += 131));
			const others = SIM_MONSTER_TYPES.filter(t => t !== type);
			let wins = 0;
			let decisive = 0;
			for (let batch = 0; batch < CURVE_BATCHES; batch += 1) {
				const opponent = others[Math.floor(pick() * others.length)]!;
				const res = await simulate({
					monsters: [
						{ type, level, role: 'human' },
						{ type: opponent, level, role: 'human' },
					],
					fights: FIGHTS,
					seed: seed + batch * 7919,
					roomId: `sim-rings-curve-${type}-${level}-${batch}`,
				});
				const w1 = res.winRates['Sim 1'] ?? 0;
				const w2 = res.winRates['Sim 2'] ?? 0;
				wins += w1;
				decisive += w1 + w2;
			}
			cells.push(decisive > 0 ? `${((100 * wins) / decisive).toFixed(0)}%`.padStart(7) : '     —');
		}
		process.stdout.write(`${type.padEnd(14)}${classOf(type).padEnd(11)}${cells.join('')}\n`);
	}
	process.stdout.write('(share of decisive fights won; 50% is even)\n');
}

interface Tally {
	wins: number;
	fair: number;
	rings: number;
}

async function sampledRings(): Promise<void> {
	process.stdout.write(`\n=== ${SAMPLED_RINGS} sampled rings (${FIGHTS} fights each) ===\n`);
	const pick = mulberry32(8111);
	const byType = new Map<string, Tally>(SIM_MONSTER_TYPES.map(t => [t, { wins: 0, fair: 0, rings: 0 }]));
	const bySize = new Map<number, { humanWins: number; rings: number }>();
	let bossRings = 0;
	let bossRingHumanWins = 0;

	for (let r = 0; r < SAMPLED_RINGS; r += 1) {
		const size = weighted(pick, RING_SIZES);
		const withBosses = pick() < 0.4;
		// With bosses, one per human (the ring's quota), so humans are half the ring, rounded up.
		const humanCount = withBosses ? Math.max(1, Math.ceil(size / 2)) : size;
		const humans: SimMonsterSpec[] = Array.from({ length: humanCount }, () => ({
			type: SIM_MONSTER_TYPES[Math.floor(pick() * SIM_MONSTER_TYPES.length)]!,
			level: weighted(pick, HUMAN_LEVELS),
			role: 'human' as const,
		}));
		// Sometimes two humans came in together and arranged a team.
		if (humans.length >= 2 && pick() < 0.25) {
			humans[0]!.team = 'Pair';
			humans[1]!.team = 'Pair';
		}

		const bosses: SimMonsterSpec[] = [];
		if (withBosses) {
			// The ring's level rules: at most the strongest human + 1, within the humans'
			// combined levels + 1, and otherwise often the average.
			const levels = humans.map(h => h.level);
			const ceiling = Math.max(...levels) + 1;
			const average = Math.floor(levels.reduce((a, b) => a + b, 0) / levels.length);
			let budget = levels.reduce((a, b) => a + b, 0) + 1;
			for (let b = 0; b < humans.length; b += 1) {
				const banded = pick() < 0.35 ? ceiling : average;
				const cap = Math.max(0, Math.min(banded, ceiling, budget));
				// As the ring does: XP drawn evenly up to the cap's XP, then read back as a level.
				// Levels need ever more XP, so this lands near the cap far more often than an
				// even pick of levels would (a first draft did that, and bosses came out weak).
				const level = getLevel(Math.floor(pick() * (getXpCapForLevel(cap) + 1)));
				budget -= level;
				bosses.push({ type: SIM_MONSTER_TYPES[Math.floor(pick() * SIM_MONSTER_TYPES.length)]!, level, role: 'boss' });
			}
		}

		const monsters = [...humans, ...bosses];
		const res = await simulate({ monsters, fights: FIGHTS, seed: 9000 + r * 7919, roomId: `sim-rings-${r}` });

		const sizeTally = bySize.get(monsters.length) ?? { humanWins: 0, rings: 0 };
		let humanWins = 0;
		humans.forEach((human, i) => {
			const win = res.winRates[`Sim ${i + 1}`] ?? 0;
			humanWins += win;
			const tally = byType.get(human.type)!;
			tally.wins += win;
			tally.fair += 100 / monsters.length;
			tally.rings += 1;
		});
		// A team win credits both members; count the ring's human side once for the totals.
		if (humans[0]?.team && humans[1]?.team) {
			humanWins -= Math.min(res.winRates['Sim 1'] ?? 0, res.winRates['Sim 2'] ?? 0);
		}
		sizeTally.humanWins += Math.min(100, humanWins);
		sizeTally.rings += 1;
		bySize.set(monsters.length, sizeTally);
		if (withBosses) {
			bossRings += 1;
			bossRingHumanWins += Math.min(100, humanWins);
		}
	}

	process.stdout.write('\nEach monster as a human: its wins against its fair share (1 in ring size):\n');
	for (const [type, t] of byType) {
		if (t.rings === 0) continue;
		const ratio = t.fair > 0 ? t.wins / t.fair : 0;
		process.stdout.write(`  ${type.padEnd(14)}${classOf(type).padEnd(11)} ${t.rings.toString().padStart(3)} rings  ${(100 * ratio).toFixed(0).padStart(4)}% of fair share\n`);
	}
	process.stdout.write(`\nRings with bosses: ${bossRings}; a human won ${(bossRings ? bossRingHumanWins / bossRings : 0).toFixed(1)}% of their fights.\n`);
	process.stdout.write('A human won, by ring size:\n');
	for (const [size, t] of [...bySize.entries()].sort((a, b) => a[0] - b[0])) {
		process.stdout.write(`  ${String(size).padStart(2)} monsters: ${t.rings.toString().padStart(3)} rings, ${(t.humanWins / t.rings).toFixed(1)}%\n`);
	}
}

async function main(): Promise<void> {
	await engineReady;
	const only = process.argv[2];
	if (!only || only === 'curves') await classCurves();
	if (!only || only === 'rings') await sampledRings();
	// Same forced exit as the other sim scripts (see simulation-harness.md).
	process.exit(0);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
