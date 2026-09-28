#!/usr/bin/env node
/**
 * The mega boss against gathered challengers: `node dist/scripts/sim-mega.js`.
 *
 * The owner chose "humans win about 20%" (docs/roadmap/32-pass-c-mega-boss-and-balance.md).
 * Each scenario is two to four humans (random monster types, half on likely decks and half on
 * random hands) against a boss and its minions built exactly as the ring builds them: the
 * engine's `fitMegaBoss` from the humans' own levels and HP, `empowerMegaBoss` (fitted HP and
 * relics), and minions at `megaMinionHp`. Prints how often a human won.
 *
 * `SIM_MEGA_HP_SCALE` multiplies the engine's fitted HP, to calibrate it;
 * `SIM_MEGA_FIGHTS` sets fights per batch (default 20).
 */
import '../sim-env.js';
import '../set-env.js';
import {
	empowerMegaBoss,
	engineReady,
	fitMegaBoss,
	MEGA_BOSS_LEVEL_BONUS,
	MEGA_BOSS_MINIONS,
	megaMinionHp,
	type Contestant,
} from '@deck-monsters/engine';
import { sideWinRate, simulate, SIM_MONSTER_TYPES, type SimMonsterSpec } from '../simulate.js';
import { mulberry32 } from '../rng.js';

const FIGHTS = Number(process.env.SIM_MEGA_FIGHTS ?? 20);
const HP_SCALE = Number(process.env.SIM_MEGA_HP_SCALE ?? 1);
const BATCHES = 6;
const GROUPS = [2, 3, 4];
const LEVELS = [1, 3, 6, 10];

async function main(): Promise<void> {
	await engineReady;
	process.stdout.write(`Mega boss, fitted HP × ${HP_SCALE}: ${BATCHES} batches × ${FIGHTS} fights per cell\n\n`);
	process.stdout.write(`${'humans'.padEnd(8)}${LEVELS.map(level => `L${level}`.padStart(8)).join('')}\n`);
	let seed = 4201;
	let total = 0;
	let cells = 0;
	for (const size of GROUPS) {
		const row: string[] = [];
		for (const level of LEVELS) {
			const pick = mulberry32((seed += 97));
			let win = 0;
			for (let batch = 0; batch < BATCHES; batch += 1) {
				const type = () => SIM_MONSTER_TYPES[Math.floor(pick() * SIM_MONSTER_TYPES.length)]!;
				const humans: SimMonsterSpec[] = Array.from({ length: size }, (_, i) => ({
					type: type(),
					level,
					role: 'human' as const,
					deckStyle: i % 2 === 0 ? ('likely' as const) : ('random' as const),
				}));
				// Every human in a cell shares one level, so the fitted levels are known up front: the
				// boss two above it, the minions at it (`fitMegaBoss`). HP and relics are fitted below
				// from the humans actually built, as the ring fits them when the mega boss arrives.
				const bosses: SimMonsterSpec[] = Array.from({ length: 1 + MEGA_BOSS_MINIONS }, (_, i) => ({
					type: type(),
					level: i === 0 ? level + MEGA_BOSS_LEVEL_BONUS : level,
					role: 'boss' as const,
				}));
				const res = await simulate({
					monsters: [...humans, ...bosses],
					fights: FIGHTS,
					seed: seed + batch * 7919,
					roomId: `sim-mega-${size}-${level}-${batch}`,
					onContestants: contestants => {
						const all = contestants as Contestant[];
						const people = all.filter(contestant => !contestant.isBoss);
						const [boss, ...minions] = all.filter(contestant => contestant.isBoss);
						const fit = fitMegaBoss(people.map(({ monster }) => ({ level: monster.level, maxHp: monster.maxHp })));
						fit.maxHp = Math.max(1, Math.round(fit.maxHp * HP_SCALE));
						empowerMegaBoss(boss!.monster, fit);
						for (const minion of minions) minion.monster.hp = megaMinionHp(minion.monster);
					},
				});
				win += sideWinRate(res, humans.map((_, i) => `Sim ${i + 1}`));
			}
			const rate = win / BATCHES;
			total += rate;
			cells += 1;
			row.push(`${rate.toFixed(0)}%`.padStart(8));
		}
		process.stdout.write(`${String(size).padEnd(8)}${row.join('')}\n`);
	}
	process.stdout.write(`\nHumans won ${(total / cells).toFixed(1)}% overall (target about 20%).\n`);
	// Same forced exit as the other sim scripts (see simulation-harness.md).
	process.exit(0);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
