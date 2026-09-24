#!/usr/bin/env node
/**
 * Coin and XP distributions from `simulate()` (roadmap 11 "Economy telemetry"), plus the
 * "new player" 1/5/20-fight progression scenario. Prints observed engine payouts — see
 * `SimResult.coinsByOutcome` / `xpPerMonster` docblocks in `simulate.ts` for why these are
 * read as before/after diffs rather than recomputed from `constants/coins.ts`. The
 * `simulate()` numbers are steady-state (daily/early-battle bonuses pinned off); the new
 * player scenario is the bonus-inclusive counterpart — see `docs/reference/simulation-harness.md`.
 */

import '../sim-env.js';
import '../set-env.js';
import { engineReady } from '@deck-monsters/engine';
import { simulate, simulateNewPlayerProgression, type EconomyStats } from '../simulate.js';

const FIGHTS = 500;

function formatStats(stats: EconomyStats): string {
	if (stats.count === 0) return '(none observed)';
	return (
		`n=${stats.count}` +
		`  mean=${stats.mean.toFixed(2)}` +
		`  p50=${stats.p50.toFixed(2)}` +
		`  p90=${stats.p90.toFixed(2)}` +
		`  min=${stats.min.toFixed(2)}` +
		`  max=${stats.max.toFixed(2)}`
	);
}

async function main(): Promise<void> {
	await engineReady;

	process.stdout.write(`Coin & XP distributions over ${FIGHTS} fights (Basilisk vs Gladiator, level 5)\n\n`);

	const res = await simulate({
		monsters: [
			{ type: 'Basilisk', level: 5 },
			{ type: 'Gladiator', level: 5 },
		],
		fights: FIGHTS,
		seed: 12345,
		roomId: 'sim-economy',
	});

	process.stdout.write(
		'Steady-state coins per fight by outcome (contestant.character.coins delta; daily/early-battle bonuses pinned off — see simulateNewPlayerProgression() below for the bonus-inclusive numbers):\n',
	);
	for (const outcome of ['win', 'loss', 'draw', 'fled', 'permaDeath'] as const) {
		const stats = res.coinsByOutcome[outcome];
		process.stdout.write(`  ${outcome.padEnd(11)} ${stats ? formatStats(stats) : '(none observed)'}\n`);
	}
	if (res.cancelledFights > 0) {
		process.stdout.write(`  (${res.cancelledFights} fight(s) cancelled by the engine and excluded from the above)\n`);
	}

	process.stdout.write('\nMonster combat XP per fight (monster.xp delta, all outcomes pooled):\n');
	process.stdout.write(`  ${formatStats(res.xpPerMonster)}\n`);

	process.stdout.write('\n--- New player scenario (bonuses included) ---\n');
	process.stdout.write('One fresh character vs a fixed level-1 opponent, checkpoints at fights 1, 5, 20:\n\n');

	const checkpoints = await simulateNewPlayerProgression({
		playerType: 'Gladiator',
		opponentType: 'Basilisk',
		opponentLevel: 1,
		checkpoints: [1, 5, 20],
		seed: 4242,
		roomId: 'sim-economy-newplayer',
	});

	process.stdout.write(
		`  ${'After fights'.padEnd(14)}${'Coins'.padEnd(8)}${'Character XP'.padEnd(15)}${'Monster XP'.padEnd(13)}${'W-L'}\n`,
	);
	for (const cp of checkpoints) {
		process.stdout.write(
			`  ${String(cp.afterFights).padEnd(14)}${String(cp.coins).padEnd(8)}${String(cp.characterXp).padEnd(15)}${String(cp.monsterXpGained).padEnd(13)}${cp.wins}-${cp.losses}\n`,
		);
	}

	// See sim-winrates.ts's matching comment: loading the engine leaves something running
	// that Node's own exit checks don't see, so a `sim:*` script hangs after printing its
	// report unless it exits itself.
	process.exit(0);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
