#!/usr/bin/env node
/**
 * Same matchup at levels 1, 5, 10, 15, 20 to spot scaling drift.
 */

import '../set-env.js';
import { engineReady } from '@deck-monsters/engine';
import { simulate } from '../simulate.js';

const LEVELS = [1, 5, 10, 15, 20];
const FIGHTS = 200;

async function main(): Promise<void> {
	await engineReady;

	process.stdout.write('Matchup: Basilisk (Sim 1) vs Gladiator (Sim 2), same level each row\n\n');

	for (const level of LEVELS) {
		const res = await simulate({
			monsters: [
				{ type: 'Basilisk', level },
				{ type: 'Gladiator', level },
			],
			fights: FIGHTS,
			seed: 7 + level,
			roomId: `sim-level-${level}`,
		});
		const w1 = res.winRates['Sim 1'] ?? 0;
		const w2 = res.winRates['Sim 2'] ?? 0;
		process.stdout.write(
			`Level ${String(level).padStart(2)}  Sim1 ${w1.toFixed(1).padStart(5)}%  Sim2 ${w2.toFixed(1).padStart(5)}%  draw ${res.drawRate.toFixed(1).padStart(5)}%  rounds ${res.avgRounds.toFixed(1)}\n`,
		);
	}
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
