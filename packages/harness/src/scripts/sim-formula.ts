#!/usr/bin/env node
/**
 * Layer 0 of the balance methodology (roadmap 34): the chassis table and per-play strike
 * math, with no fights. `node dist/scripts/sim-formula.js [--json out.json]`.
 *
 * Everything is read from real engine objects, not restated formulas, so this cannot drift
 * from the game: each monster is built at each level (averaging its random HP and AC
 * variance over many instances), and a Hit's and a Blast's per-play damage come from the
 * cards' own roll methods against a random field at the same level. Turns to kill (TTK) is
 * a field opponent's HP over expected damage per play: the hypothesis to test is that past
 * level 10 a Hit's TTK climbs (HP keeps growing, the strike does not) while a level-scaled
 * spell's holds.
 */
import '../sim-env.js';
import '../set-env.js';
import { writeFileSync } from 'node:fs';
import { allMonsters, engineReady, getCardClassByTypeName, getXpCapForLevel } from '@deck-monsters/engine';
import { SIM_MONSTER_TYPES } from '../simulate.js';
import { mulberry32 } from '../rng.js';

const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 10, 12, 15, 20];
const INSTANCES = 200;
const PLAYS = 4000;

interface Monster {
	level: number;
	maxHp: number;
	ac: number;
	dexModifier: number;
	strModifier: number;
	intModifier: number;
}
type MonsterClass = (new (options: Record<string, unknown>) => Monster) & { name: string; creatureType?: string };
interface HitLike {
	hitCheck(player: Monster, target: Monster): { success: boolean; strokeOfLuck: boolean; curseOfLoki: boolean };
	rollForDamage(player: Monster, target?: Monster, strokeOfLuck?: boolean): { result: number };
}
interface BlastLike {
	damage: number;
	levelDamage: number;
}

const classFor = (type: string): MonsterClass => {
	const classes = allMonsters as unknown as MonsterClass[];
	const found = classes.find(M => M.name === type) ?? classes.find(M => M.creatureType === type);
	if (!found) throw new Error(`No monster class ${type}`);
	return found;
};

function build(type: string, level: number): Monster {
	const Monster = classFor(type);
	// The cap for a level is the XP just under the next; its level is `level` exactly.
	const monster = new Monster({ name: `${type}-${level}`, xp: getXpCapForLevel(level) });
	return monster;
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

async function main(): Promise<void> {
	await engineReady;
	Math.random = mulberry32(3400);
	const jsonIndex = process.argv.indexOf('--json');
	const jsonOut = jsonIndex >= 0 ? process.argv[jsonIndex + 1] : undefined;

	const chassis: Record<string, Record<number, Record<string, number>>> = {};
	const strikes: Record<string, Record<number, Record<string, number>>> = {};
	const HitCard = getCardClassByTypeName('Hit') as unknown as new () => HitLike;
	const BlastCard = getCardClassByTypeName('Blast') as unknown as new () => BlastLike;
	const hit = new HitCard();
	const blast = new BlastCard();
	// hitCheck narrates through the card's emitter; nobody listens here.

	for (const level of LEVELS) {
		const pools = new Map<string, Monster[]>();
		for (const type of SIM_MONSTER_TYPES) {
			const pool = Array.from({ length: INSTANCES }, () => build(type, level));
			pools.set(type, pool);
			const row = {
				level: mean(pool.map(m => m.level)),
				hp: mean(pool.map(m => m.maxHp)),
				ac: mean(pool.map(m => m.ac)),
				dexMod: mean(pool.map(m => m.dexModifier)),
				strMod: mean(pool.map(m => m.strModifier)),
				intMod: mean(pool.map(m => m.intModifier)),
			};
			(chassis[type] ??= {})[level] = row;
		}
		const field = [...pools.values()].flat();
		const fieldHp = mean(field.map(m => m.maxHp));

		for (const type of SIM_MONSTER_TYPES) {
			const attackers = pools.get(type)!;
			let damage = 0;
			let landed = 0;
			let backfire = 0;
			for (let i = 0; i < PLAYS; i += 1) {
				const player = attackers[i % attackers.length]!;
				const target = field[Math.floor(Math.random() * field.length)]!;
				const { success, strokeOfLuck, curseOfLoki } = hit.hitCheck(player, target);
				if (success) {
					landed += 1;
					damage += hit.rollForDamage(player, target, strokeOfLuck).result;
				} else if (curseOfLoki) {
					backfire += hit.rollForDamage(target, player).result;
				}
			}
			const hitDamage = damage / PLAYS;
			const blastDamage = blast.damage + blast.levelDamage * scaledLevel(level);
			(strikes[type] ??= {})[level] = {
				hitChance: landed / PLAYS,
				hitDamagePerPlay: hitDamage,
				hitBackfirePerPlay: backfire / PLAYS,
				hitTurnsToKill: fieldHp / Math.max(0.01, hitDamage),
				blastDamagePerTarget: blastDamage,
				blastTurnsToKill: fieldHp / blastDamage,
				fieldHp,
			};
		}
	}

	const pad = (x: string | number, n: number): string => String(x).padStart(n);
	process.stdout.write('Chassis by level (mean over instances): HP / AC / DEX mod / STR mod / INT mod\n');
	for (const type of SIM_MONSTER_TYPES) {
		process.stdout.write(`${type.padEnd(13)}${LEVELS.map(l => {
			const c = chassis[type]![l]!;
			return pad(`${c.hp!.toFixed(0)}/${c.ac!.toFixed(0)}/${c.dexMod!.toFixed(0)}/${c.strMod!.toFixed(0)}/${c.intMod!.toFixed(0)}`, 16);
		}).join('')}\n`);
	}
	process.stdout.write(`${'levels'.padEnd(13)}${LEVELS.map(l => pad(`L${l}`, 16)).join('')}\n\n`);
	process.stdout.write('Hit against the field: chance to land / damage per play / turns to kill a field opponent\n');
	for (const type of SIM_MONSTER_TYPES) {
		process.stdout.write(`${type.padEnd(13)}${LEVELS.map(l => {
			const s = strikes[type]![l]!;
			return pad(`${(100 * s.hitChance!).toFixed(0)}%/${s.hitDamagePerPlay!.toFixed(1)}/${s.hitTurnsToKill!.toFixed(1)}`, 16);
		}).join('')}\n`);
	}
	const any = strikes[SIM_MONSTER_TYPES[0]!]!;
	process.stdout.write(`${'Blast'.padEnd(13)}${LEVELS.map(l => pad(`100%/${any[l]!.blastDamagePerTarget!.toFixed(1)}/${any[l]!.blastTurnsToKill!.toFixed(1)}`, 16)).join('')}\n`);
	process.stdout.write(`${'field HP'.padEnd(13)}${LEVELS.map(l => pad(any[l]!.fieldHp!.toFixed(0), 16)).join('')}\n`);
	process.stdout.write('(Blast hits every opponent and cannot miss; its damage per target is shown per play.)\n');

	if (jsonOut) writeFileSync(jsonOut, `${JSON.stringify({ levels: LEVELS, chassis, strikes }, null, 1)}\n`);
	process.exit(0);
}

/** `scaledCasterLevel` from cards/blast.ts: full scaling to level 10, half past it. */
function scaledLevel(level: number): number {
	return Math.min(level, 10) + Math.floor(Math.max(0, level - 10) / 2);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
