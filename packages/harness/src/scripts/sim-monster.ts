#!/usr/bin/env node
/**
 * Balance report for one monster: `node dist/scripts/sim-monster.js <type>`.
 *
 * Runs the monster against every other monster in the engine's roster at levels
 * 1/5/10/15/20, with random legal decks and (when its report has one) a thematic fixture
 * deck, plus a mirror match, a 2v2 team fight, and a crowded free-for-all, where area cards
 * change value. Card counters come from the monster's report in `monster-reports/`, or the
 * generic count of its own cards. Run manually before balance merges (not in CI).
 *
 * This generalizes the Unicorn pack's `sim-unicorn` (docs/archive/roadmap/26-unicorn-pack.md);
 * `pnpm sim:unicorn` still runs it for the Unicorn.
 */

import '../sim-env.js';
import '../set-env.js';
import { allMonsters, engineReady } from '@deck-monsters/engine';
import { parseMonsterType, simulate, SIM_MONSTER_TYPES, type SimMonsterSpec, type SimResult } from '../simulate.js';
import { reportFor } from './monster-reports/index.js';

const LEVELS = [1, 5, 10, 15, 20] as const;
const FIGHTS = Number(process.env.SIM_MONSTER_FIGHTS ?? process.env.SIM_UNICORN_FIGHTS ?? 100);
const WARN_LOW = 35;
const WARN_HIGH = 65;
/** Allies and opponents for the team and crowd fights, in order of preference. */
const TEAM_PREFERENCE = ['Gladiator', 'Minotaur', 'Basilisk', 'Jinn', 'WeepingAngel', 'Unicorn'];

if (!process.argv[2]) {
	process.stderr.write(`Usage: sim-monster <type>, one of: ${SIM_MONSTER_TYPES.join(', ')}\n`);
	process.exit(1);
}
const subject = parseMonsterType(process.argv[2]);
const creatureType = (
	allMonsters.find(M => (M as unknown as { name: string }).name === subject) as unknown as { creatureType: string }
).creatureType;
const report = reportFor(creatureType);
const others = SIM_MONSTER_TYPES.filter(type => type !== subject);
const isSubject = (creature: unknown): boolean =>
	(creature as { creatureType?: string } | undefined)?.creatureType === creatureType;

async function run(label: string, monsters: SimMonsterSpec[], seed: number): Promise<{ res: SimResult; counts: Record<string, number> }> {
	report.reset();
	const res = await simulate({ monsters, fights: FIGHTS, seed, roomId: `sim-monster-${subject}-${label}` });
	return { res, counts: report.snapshot() };
}

/** Sim 1's share of the fights somebody won, or undefined when every fight was a draw. */
function decisiveShare(res: SimResult): number | undefined {
	const w1 = res.winRates['Sim 1'] ?? 0;
	const w2 = res.winRates['Sim 2'] ?? 0;
	return w1 + w2 > 0 ? (100 * w1) / (w1 + w2) : undefined;
}

function topDamage(res: SimResult): string {
	return Object.entries(res.avgDamagePerCard)
		.sort(([, a], [, b]) => b - a)
		.slice(0, 4)
		.map(([card, dmg]) => `${card} ${dmg.toFixed(1)}`)
		.join(', ');
}

const add = (into: Record<string, number>, from: Record<string, number>): void => {
	for (const [key, value] of Object.entries(from)) into[key] = (into[key] ?? 0) + value;
};

async function main(): Promise<void> {
	await engineReady;
	report.instrument(isSubject);

	const modes = report.fixtureDeck ? (['random', 'fixture'] as const) : (['random'] as const);
	const deckFor = (mode: 'random' | 'fixture') => (mode === 'fixture' ? { deck: report.fixtureDeck } : {});
	const judged = report.fixtureDeck ? 'fixture' : 'random';
	const warnings: string[] = [];
	let seed = 4242;

	for (const mode of modes) {
		const totals: Record<string, number> = {};
		process.stdout.write(`\n=== ${subject} (${mode === 'fixture' ? 'thematic fixture deck' : 'random legal deck'}) vs each monster, ${FIGHTS} fights per row ===\n`);
		for (const level of LEVELS) {
			for (const opponent of others) {
				const { res, counts } = await run(
					`${mode}-${level}-${opponent}`,
					[{ type: subject, level, ...deckFor(mode) }, { type: opponent, level }],
					(seed += 997),
				);
				add(totals, counts);
				const w = res.winRates['Sim 1'] ?? 0;
				const share = decisiveShare(res);
				// Some decks carry heals and rests, so some fights end without a winner; judge
				// the review band on decisive fights, and print both. Only the fixture is judged
				// when there is one: random decks are the control, not the design.
				if (mode === judged && share !== undefined && (share < WARN_LOW || share > WARN_HIGH)) {
					warnings.push(`${mode} L${level} vs ${opponent}: ${subject} wins ${share.toFixed(1)}% of decisive fights`);
				}
				process.stdout.write(
					`L${String(level).padEnd(2)} vs ${opponent.padEnd(12)} ${subject} win ${w.toFixed(1).padStart(5)}%  decisive ${share === undefined ? '    —' : share.toFixed(1).padStart(5)}%  draw ${res.drawRate.toFixed(1).padStart(5)}%  rounds ${res.avgRounds.toFixed(1)}  top dmg/card: ${topDamage(res)}\n`,
				);
			}
		}
		process.stdout.write(`  totals:\n    ${report.describe(totals)}\n`);
	}

	const fixture = report.fixtureDeck ? deckFor('fixture') : {};
	process.stdout.write(`\n=== Mirror, team, and crowd fights (level 5${report.fixtureDeck ? ', thematic fixture' : ''}) ===\n`);
	const mirror = await run('mirror', [
		{ type: subject, level: 5, ...fixture },
		{ type: subject, level: 5, ...fixture },
	], (seed += 997));
	process.stdout.write(
		`Mirror: Sim 1 ${(mirror.res.winRates['Sim 1'] ?? 0).toFixed(1)}% (decisive ${decisiveShare(mirror.res)?.toFixed(1) ?? '—'}%)  Sim 2 ${(mirror.res.winRates['Sim 2'] ?? 0).toFixed(1)}%  draw ${mirror.res.drawRate.toFixed(1)}%  rounds ${mirror.res.avgRounds.toFixed(1)}\n    ${report.describe(mirror.counts)}\n`,
	);

	const pool = [
		...TEAM_PREFERENCE.filter(type => others.includes(type)),
		...others.filter(type => !TEAM_PREFERENCE.includes(type)),
	];
	const [ally, foeA, foeB] = pool;
	const team = await run('team', [
		{ type: subject, level: 5, ...fixture, team: 'Laurel' },
		{ type: ally!, level: 5, team: 'Laurel' },
		{ type: foeA!, level: 5, team: 'Gorge' },
		{ type: foeB!, level: 5, team: 'Gorge' },
	], (seed += 997));
	const member = (label: string) => (team.res.winRates[label] ?? 0).toFixed(1);
	// A team win credits every surviving member, so these are per-member win rates.
	process.stdout.write(
		`Team (Laurel: ${subject}, ${ally} vs Gorge: ${foeA}, ${foeB}), member wins: ${subject} ${member('Sim 1')}%  ${ally} ${member('Sim 2')}%  ${foeA} ${member('Sim 3')}%  ${foeB} ${member('Sim 4')}%  draw ${team.res.drawRate.toFixed(1)}%  rounds ${team.res.avgRounds.toFixed(1)}\n    ${report.describe(team.counts)}\n`,
	);

	// A free-for-all with every other monster once: area damage (and any self-hit) scales
	// with the number of contestants, which the 1v1 rows cannot show. The fair share of wins
	// is 1 in (others + 1).
	const crowd = await run('crowd', [
		{ type: subject, level: 5, ...fixture },
		...others.map(type => ({ type, level: 5 })),
	], (seed += 997));
	const fair = 100 / (others.length + 1);
	process.stdout.write(
		`Crowd (${others.length + 1} monsters, free-for-all): ${subject} ${(crowd.res.winRates['Sim 1'] ?? 0).toFixed(1)}% (fair share ${fair.toFixed(1)}%)  draw ${crowd.res.drawRate.toFixed(1)}%  rounds ${crowd.res.avgRounds.toFixed(1)}  top dmg/card: ${topDamage(crowd.res)}\n    ${report.describe(crowd.counts)}\n`,
	);

	if (warnings.length) {
		process.stdout.write(`\n--- ${judged === 'fixture' ? 'Fixture matchups' : 'Matchups'} outside the 35–65% review band (decisive fights) ---\n`);
		for (const w of warnings) process.stdout.write(`${w}\n`);
		process.exitCode = 1;
	}

	// Same forced exit as sim-winrates.ts: the engine leaves the loader holding a reference
	// Node's handle accounting doesn't see, so the process otherwise never exits.
	process.exit(process.exitCode ?? 0);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
