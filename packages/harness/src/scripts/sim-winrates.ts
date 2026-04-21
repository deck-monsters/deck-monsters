#!/usr/bin/env node
/**
 * All 5×5 monster type matchups at a fixed level; flags win rates outside 35–65%.
 * Run manually before balance merges (not in CI).
 */

import '../set-env.js';
import { engineReady } from '@deck-monsters/engine';
import { parseMonsterType, simulate, type SimMonsterSpec } from '../simulate.js';

const TYPES = ['Basilisk', 'Gladiator', 'Jinn', 'Minotaur', 'WeepingAngel'] as const;
const FIGHTS_PER_PAIR = 200;
const LEVEL = 5;
const WARN_LOW = 35;
const WARN_HIGH = 65;

async function main(): Promise<void> {
	await engineReady;
	const warnings: string[] = [];

	let pairIdx = 0;
	for (const a of TYPES) {
		for (const b of TYPES) {
			const monsters: SimMonsterSpec[] = [
				{ type: parseMonsterType(a), level: LEVEL },
				{ type: parseMonsterType(b), level: LEVEL },
			];
			const key = `${a} vs ${b}`;
			const res = await simulate({
				monsters,
				fights: FIGHTS_PER_PAIR,
				seed: 42 + pairIdx * 997,
				roomId: `sim-winrates-${a}-${b}`,
			});
			pairIdx += 1;
			const w1 = res.winRates['Sim 1'] ?? 0;
			if (w1 < WARN_LOW || w1 > WARN_HIGH) {
				warnings.push(`${key}: Sim1 win ${w1.toFixed(1)}% (target ${WARN_LOW}–${WARN_HIGH}%)`);
			}
			process.stdout.write(
				`${key.padEnd(28)} Sim1 ${w1.toFixed(1).padStart(5)}%  draw ${res.drawRate.toFixed(1).padStart(5)}%  avgRounds ${res.avgRounds.toFixed(1)}\n`,
			);
		}
	}

	if (warnings.length) {
		process.stdout.write('\n--- Balance warnings ---\n');
		for (const w of warnings) process.stdout.write(`${w}\n`);
		process.exitCode = 1;
	}
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
