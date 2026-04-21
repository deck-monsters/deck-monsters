#!/usr/bin/env node
/**
 * Average damage dealt per card type over many fights; highlights top/bottom 10%.
 */

import '../set-env.js';
import { engineReady } from '@deck-monsters/engine';
import { simulate } from '../simulate.js';

const FIGHTS = 1000;

async function main(): Promise<void> {
	await engineReady;

	const res = await simulate({
		monsters: [
			{ type: 'Basilisk', level: 5 },
			{ type: 'Gladiator', level: 5 },
		],
		fights: FIGHTS,
		seed: 99,
		roomId: 'sim-cardpower',
	});

	const entries = Object.entries(res.avgDamagePerCard)
		.filter(([, v]) => v > 0)
		.sort((a, b) => b[1] - a[1]);

	const n = entries.length;
	const topN = Math.max(1, Math.ceil(n * 0.1));
	const bottomN = topN;

	process.stdout.write(`Fights: ${res.fights}  avg rounds: ${res.avgRounds.toFixed(2)}\n\n`);
	process.stdout.write('Top 10% by avg damage per play:\n');
	for (const [name, avg] of entries.slice(0, topN)) {
		process.stdout.write(`  ${name.padEnd(24)} ${avg.toFixed(2)}\n`);
	}
	process.stdout.write('\nBottom 10%:\n');
	for (const [name, avg] of entries.slice(-bottomN)) {
		process.stdout.write(`  ${name.padEnd(24)} ${avg.toFixed(2)}\n`);
	}
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
