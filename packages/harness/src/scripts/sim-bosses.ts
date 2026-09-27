#!/usr/bin/env node
/**
 * Humans against bosses: `node dist/scripts/sim-bosses.js`.
 *
 * The owner's report (2026-09-27, docs/roadmap/31-pass-b-rings-and-bosses.md): several
 * bosses with one human are close to hopeless, because bosses share a team and humans do
 * not. Each scenario is a ring of humans (player starting decks, default targeting, no team
 * unless the scenario gives one) and real bosses (the Boss team, boss decks, boss
 * targeting), exactly as the ring spawns them. Monster types are drawn at random for every
 * batch, so a row is not one species' matchup. Prints how often a human won.
 * `SIM_BOSSES_FIGHTS` sets fights per batch (default 25); each row runs 8 batches.
 */

import '../sim-env.js';
import '../set-env.js';
import { engineReady } from '@deck-monsters/engine';
import { simulate, SIM_MONSTER_TYPES, type SimMonsterSpec } from '../simulate.js';
import { mulberry32 } from '../rng.js';

const FIGHTS = Number(process.env.SIM_BOSSES_FIGHTS ?? 25);
const BATCHES = 8;

interface Scenario {
	label: string;
	humans: number[];
	bosses: number[];
	/** Put the humans on one team (as if they pre-arranged it). */
	humanTeam?: boolean;
}

/**
 * The owner's examples first (the hopeless ones can no longer spawn, and stay as the
 * baseline), then fights the new rules produce: one boss per human at up to the strongest
 * human + 1, an occasional ambush of one more, and bosses within the humans' combined
 * levels + 1 (docs/roadmap/31-pass-b-rings-and-bosses.md).
 */
export const SCENARIOS: Scenario[] = [
	{ label: 'L1 vs one L1 boss', humans: [1], bosses: [1] },
	{ label: 'L1 vs one L2 boss', humans: [1], bosses: [2] },
	{ label: 'L2 vs two beginner bosses', humans: [2], bosses: [0, 0] },
	{ label: 'L1 vs two L1 bosses (old rules)', humans: [1], bosses: [1, 1] },
	{ label: 'L1 vs beginner + L1 + L5 (old rules)', humans: [1], bosses: [0, 1, 5] },
	{ label: 'two L1s vs L1 + L2 bosses', humans: [1, 1], bosses: [1, 2] },
	{ label: 'two L1s, one team, vs L1 + L2 bosses', humans: [1, 1], bosses: [1, 2], humanTeam: true },
	{ label: 'L3 vs L4 boss (ceiling)', humans: [3], bosses: [4] },
	{ label: 'L1 ambush: L1 + beginner bosses', humans: [1], bosses: [1, 0] },
	{ label: 'L3 ambush: L3 + L1 bosses', humans: [3], bosses: [3, 1] },
	{ label: 'two L2s vs L3 + L2 bosses', humans: [2, 2], bosses: [3, 2] },
	{ label: 'two L2s ambush: L3 + L1 + L1', humans: [2, 2], bosses: [3, 1, 1] },
	{ label: 'three L3s vs L4 + L3 + L2 bosses', humans: [3, 3, 3], bosses: [4, 3, 2] },
];

export interface ScenarioResult {
	label: string;
	/** Share of fights a human won (a team win counts once). */
	humanWin: number;
	draw: number;
	rounds: number;
}

export async function runScenario(scenario: Scenario, seed: number, fights = FIGHTS): Promise<ScenarioResult> {
	const pick = mulberry32(seed);
	const type = () => SIM_MONSTER_TYPES[Math.floor(pick() * SIM_MONSTER_TYPES.length)]!;
	let humanWin = 0;
	let draw = 0;
	let rounds = 0;

	for (let batch = 0; batch < BATCHES; batch += 1) {
		const monsters: SimMonsterSpec[] = [
			...scenario.humans.map(level => ({
				type: type(),
				level,
				role: 'human' as const,
				...(scenario.humanTeam ? { team: 'Challengers' } : {}),
			})),
			...scenario.bosses.map(level => ({ type: type(), level, role: 'boss' as const })),
		];
		const res = await simulate({ monsters, fights, seed: seed + batch * 7919, roomId: `sim-bosses-${seed}-${batch}` });
		const humanLabels = scenario.humans.map((_, i) => `Sim ${i + 1}`);
		const rates = humanLabels.map(label => res.winRates[label] ?? 0);
		// On one team, a team win credits every surviving member, so take the best member;
		// apart, only one monster can win a fight, so the rates add.
		humanWin += scenario.humanTeam ? Math.max(...rates) : rates.reduce((a, b) => a + b, 0);
		draw += res.drawRate;
		rounds += res.avgRounds;
	}

	return { label: scenario.label, humanWin: humanWin / BATCHES, draw: draw / BATCHES, rounds: rounds / BATCHES };
}

async function main(): Promise<void> {
	await engineReady;
	process.stdout.write(`Humans vs bosses: ${BATCHES} batches × ${FIGHTS} fights per row, random monster types\n\n`);
	let seed = 1701;
	for (const scenario of SCENARIOS) {
		const r = await runScenario(scenario, (seed += 1009));
		process.stdout.write(
			`${r.label.padEnd(42)} human win ${r.humanWin.toFixed(1).padStart(5)}%  draw ${r.draw.toFixed(1).padStart(5)}%  rounds ${r.rounds.toFixed(1)}\n`,
		);
	}
	// Same forced exit as the other sim scripts (see simulation-harness.md).
	process.exit(0);
}

// Run only as a script, so the scenarios can be imported by tests and other reports.
if (process.argv[1]?.endsWith('sim-bosses.js')) {
	main().catch(err => {
		console.error(err);
		process.exit(1);
	});
}
