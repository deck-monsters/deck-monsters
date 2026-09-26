#!/usr/bin/env node
/**
 * Balance report for the Unicorn content pack (docs/roadmap/23-unicorn-pack.md).
 *
 * Runs the Unicorn against every monster at levels 1/5/10/15/20, once with random legal
 * decks and once with the thematic fixture deck below, plus a mirror match and a team fight,
 * and reports the card-level rates the brief asks for. The card counters come from wrapping
 * the card classes' prototype methods for the length of this process only; nothing in the
 * engine is instrumented for this. Run manually before balance merges (not in CI).
 *
 * The fixture is a design demonstration, not a starting deck: it is assigned directly, so
 * it skips the level gate (Gloaming Rest is level 3) even in the level 1 rows. The brief's
 * ninth card was Flee; the harness keeps Flee out of every deck (see
 * `HARNESS_EXCLUDED_CARD_TYPES` in simulate.ts), so a plain Hit takes its slot.
 */

import '../sim-env.js';
import '../set-env.js';
import { engineReady, getCardClassByTypeName } from '@deck-monsters/engine';
import { simulate, type SimMonsterSpec, type SimResult } from '../simulate.js';

const OPPONENTS = ['Basilisk', 'Gladiator', 'Jinn', 'Minotaur', 'WeepingAngel'] as const;
const LEVELS = [1, 5, 10, 15, 20] as const;
const FIGHTS = Number(process.env.SIM_UNICORN_FIGHTS ?? 100);
const WARN_LOW = 35;
const WARN_HIGH = 65;

const FIXTURE_DECK = [
	'Sticketh',
	'Sticketh',
	'Horn of Proof',
	'Unconquerable Horn',
	'Dissonant Voice',
	'Gloaming Rest',
	'Heal',
	'Fists of Virtue',
	'Hit',
];

interface Counters {
	stickethPlays: number;
	stickethHits: number;
	stickethMisses: number;
	stickethStuck: number;
	wardsArmed: number;
	wardTriggers: number;
	hornOfProofPlays: number;
	hornOfProofCleansed: number;
	voiceSaves: number;
	voiceRattled: number;
	restsBegun: number;
	restsCompleted: number;
	restsInterrupted: number;
	restHealTotal: number;
}

const fresh = (): Counters => ({
	stickethPlays: 0,
	stickethHits: 0,
	stickethMisses: 0,
	stickethStuck: 0,
	wardsArmed: 0,
	wardTriggers: 0,
	hornOfProofPlays: 0,
	hornOfProofCleansed: 0,
	voiceSaves: 0,
	voiceRattled: 0,
	restsBegun: 0,
	restsCompleted: 0,
	restsInterrupted: 0,
	restHealTotal: 0,
});

let counters = fresh();

type Method = (this: unknown, ...args: unknown[]) => unknown;
type Proto = Record<string, Method>;
interface Creature {
	encounterEffects: unknown[];
	encounterModifiers: Record<string, unknown>;
}
interface EmitPayload {
	reason?: string;
	narration?: string;
	roll?: { result?: number };
}

const proto = (cardType: string): Proto =>
	(getCardClassByTypeName(cardType) as unknown as { prototype: Proto }).prototype;

const wrap = (target: Proto, method: string, around: (original: Method, self: unknown, args: unknown[]) => unknown): void => {
	const original = target[method]!;
	target[method] = function wrapped(this: unknown, ...args: unknown[]) {
		return around(original, this, args);
	};
};

const isUnicorn = (creature: unknown): boolean =>
	(creature as { creatureType?: string } | undefined)?.creatureType === 'Unicorn';

/*
 * Weeping Angels (Cleric) can also play Horn of Proof and Gloaming Rest, and Jinn (Bard)
 * Dissonant Voice, so every counter only counts a play made by a Unicorn. Methods that do
 * not receive the acting monster are credited through the per-play card clone the Unicorn
 * played, recorded in `unicornPlays` when its `effect()` (or `rest()`) starts.
 */
const unicornPlays = new WeakSet<object>();

function instrument(): void {
	const sticketh = proto('Sticketh');
	wrap(sticketh, 'hitCheck', (original, self, args) => {
		const result = original.apply(self, args) as { success: boolean };
		if (isUnicorn(args[0])) {
			counters.stickethPlays += 1;
			if (result.success) counters.stickethHits += 1;
			else counters.stickethMisses += 1;
		}
		return result;
	});
	wrap(sticketh, 'stickFast', (original, self, args) => {
		const [player] = args as [Creature];
		const before = player.encounterEffects.length;
		const result = original.apply(self, args);
		if (isUnicorn(player) && player.encounterEffects.length > before) counters.stickethStuck += 1;
		return result;
	});

	wrap(proto('Unconquerable Horn'), 'effect', (original, self, args) => {
		const [, target] = args as [unknown, Creature];
		const before = target.encounterModifiers.unconquerableWard;
		const result = original.apply(self, args);
		if (isUnicorn(target) && !before && target.encounterModifiers.unconquerableWard === 'armed') {
			counters.wardsArmed += 1;
		}
		return result;
	});
	// Every hold an opponent lands goes through `immobilize()`, which is where the ward is
	// spent. ImmobilizeCard itself is never drawn, so reach it through Sticketh's prototype.
	wrap(Object.getPrototypeOf(sticketh) as Proto, 'immobilize', (original, self, args) => {
		const [, target] = args as [unknown, Creature];
		const before = target.encounterModifiers.unconquerableWard;
		const result = original.apply(self, args);
		if (isUnicorn(target) && before === 'armed' && target.encounterModifiers.unconquerableWard === 'spent') {
			counters.wardTriggers += 1;
		}
		return result;
	});

	const horn = proto('Horn of Proof');
	wrap(horn, 'effect', (original, self, args) => {
		if (isUnicorn(args[0])) {
			unicornPlays.add(self as object);
			counters.hornOfProofPlays += 1;
		}
		return original.apply(self, args);
	});
	for (const method of ['cleanseHold', 'cleanseCurse', 'cleanseRing']) {
		wrap(horn, method, (original, self, args) => {
			const cleansed = original.apply(self, args);
			if (cleansed && unicornPlays.has(self as object)) counters.hornOfProofCleansed += 1;
			return cleansed;
		});
	}

	const voice = proto('Dissonant Voice');
	wrap(voice, 'effect', (original, self, args) => {
		if (isUnicorn(args[0])) unicornPlays.add(self as object);
		return original.apply(self, args);
	});
	wrap(voice, 'getSaveRoll', (original, self, args) => {
		if (unicornPlays.has(self as object)) counters.voiceSaves += 1;
		return original.apply(self, args);
	});
	wrap(voice, 'rattle', (original, self, args) => {
		if (unicornPlays.has(self as object)) counters.voiceRattled += 1;
		return original.apply(self, args);
	});

	const rest = proto('Gloaming Rest');
	wrap(rest, 'rest', (original, self, args) => {
		if (isUnicorn(args[0])) {
			unicornPlays.add(self as object);
			counters.restsBegun += 1;
		}
		return original.apply(self, args);
	});
	wrap(rest, 'emit', (original, self, args) => {
		const [event, payload] = args as [string, EmitPayload | undefined];
		if (unicornPlays.has(self as object)) {
			if (event === 'rolled' && payload?.reason === 'for a quiet rest.') {
				counters.restsCompleted += 1;
				counters.restHealTotal += payload.roll?.result ?? 0;
			} else if (event === 'narration' && String(payload?.narration).includes('rest was broken')) {
				counters.restsInterrupted += 1;
			}
		}
		return original.apply(self, args);
	});
}

const pct = (n: number, d: number): string => (d > 0 ? `${((100 * n) / d).toFixed(1)}%` : '—');

function describeCounters(c: Counters): string {
	return [
		`Sticketh ${c.stickethPlays} plays, hit ${pct(c.stickethHits, c.stickethPlays)}, miss ${pct(c.stickethMisses, c.stickethPlays)}, stuck ${pct(c.stickethStuck, c.stickethPlays)} of plays`,
		`ward armed ${c.wardsArmed}, triggered ${c.wardTriggers} (${pct(c.wardTriggers, c.wardsArmed)})`,
		`Horn of Proof ${c.hornOfProofPlays} plays, cleansed ${pct(c.hornOfProofCleansed, c.hornOfProofPlays)}`,
		`Dissonant Voice ${c.voiceSaves} saves, rattled ${pct(c.voiceRattled, c.voiceSaves)}`,
		`Gloaming Rest ${c.restsBegun} begun, completed ${pct(c.restsCompleted, c.restsBegun)}, interrupted ${pct(c.restsInterrupted, c.restsBegun)}, avg heal ${c.restsCompleted ? (c.restHealTotal / c.restsCompleted).toFixed(1) : '—'}`,
	].join('\n    ');
}

async function run(label: string, monsters: SimMonsterSpec[], seed: number): Promise<{ res: SimResult; counters: Counters }> {
	counters = fresh();
	const res = await simulate({ monsters, fights: FIGHTS, seed, roomId: `sim-unicorn-${label}` });
	return { res, counters };
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

async function main(): Promise<void> {
	await engineReady;
	instrument();

	const warnings: string[] = [];
	const totals = { random: fresh(), fixture: fresh() };
	let seed = 4242;

	for (const mode of ['random', 'fixture'] as const) {
		process.stdout.write(`\n=== Unicorn (${mode === 'fixture' ? 'thematic fixture deck' : 'random legal deck'}) vs each monster, ${FIGHTS} fights per row ===\n`);
		for (const level of LEVELS) {
			for (const opponent of OPPONENTS) {
				const unicorn: SimMonsterSpec = { type: 'Unicorn', level, ...(mode === 'fixture' ? { deck: FIXTURE_DECK } : {}) };
				const { res, counters: c } = await run(`${mode}-${level}-${opponent}`, [unicorn, { type: opponent, level }], (seed += 997));
				for (const key of Object.keys(c) as (keyof Counters)[]) totals[mode][key] += c[key];
				const w = res.winRates['Sim 1'] ?? 0;
				const share = decisiveShare(res);
				// The fixture carries three heals and long rests, so some fights end without a
				// winner; judge the review band on decisive fights, and print both.
				if (mode === 'fixture' && share !== undefined && (share < WARN_LOW || share > WARN_HIGH)) {
					warnings.push(`fixture L${level} vs ${opponent}: Unicorn wins ${share.toFixed(1)}% of decisive fights`);
				}
				process.stdout.write(
					`L${String(level).padEnd(2)} vs ${opponent.padEnd(12)} Unicorn win ${w.toFixed(1).padStart(5)}%  decisive ${share === undefined ? '    —' : share.toFixed(1).padStart(5)}%  draw ${res.drawRate.toFixed(1).padStart(5)}%  rounds ${res.avgRounds.toFixed(1)}  top dmg/card: ${topDamage(res)}\n`,
				);
			}
		}
		process.stdout.write(`  totals:\n    ${describeCounters(totals[mode])}\n`);
	}

	process.stdout.write('\n=== Mirror and team fights (level 5, thematic fixture) ===\n');
	const mirror = await run('mirror', [
		{ type: 'Unicorn', level: 5, deck: FIXTURE_DECK },
		{ type: 'Unicorn', level: 5, deck: FIXTURE_DECK },
	], (seed += 997));
	process.stdout.write(
		`Mirror: Sim 1 ${(mirror.res.winRates['Sim 1'] ?? 0).toFixed(1)}% (decisive ${decisiveShare(mirror.res)?.toFixed(1) ?? '—'}%)  Sim 2 ${(mirror.res.winRates['Sim 2'] ?? 0).toFixed(1)}%  draw ${mirror.res.drawRate.toFixed(1)}%  rounds ${mirror.res.avgRounds.toFixed(1)}\n    ${describeCounters(mirror.counters)}\n`,
	);

	const team = await run('team', [
		{ type: 'Unicorn', level: 5, deck: FIXTURE_DECK, team: 'Laurel' },
		{ type: 'Gladiator', level: 5, team: 'Laurel' },
		{ type: 'Minotaur', level: 5, team: 'Gorge' },
		{ type: 'Basilisk', level: 5, team: 'Gorge' },
	], (seed += 997));
	const member = (label: string) => (team.res.winRates[label] ?? 0).toFixed(1);
	// A team win credits every surviving member, so these are per-member win rates.
	process.stdout.write(
		`Team (Laurel: Unicorn, Gladiator vs Gorge: Minotaur, Basilisk), member wins: Unicorn ${member('Sim 1')}%  Gladiator ${member('Sim 2')}%  Minotaur ${member('Sim 3')}%  Basilisk ${member('Sim 4')}%  draw ${team.res.drawRate.toFixed(1)}%  rounds ${team.res.avgRounds.toFixed(1)}\n    ${describeCounters(team.counters)}\n`,
	);

	if (warnings.length) {
		process.stdout.write('\n--- Fixture matchups outside the 35–65% review band ---\n');
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
