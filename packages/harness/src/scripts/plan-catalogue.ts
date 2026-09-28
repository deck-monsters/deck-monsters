#!/usr/bin/env node
/**
 * Plan the real-card catalogue (roadmap 34 task 6): every card type (Flee aside), on the
 * reference chassis, in each slot of a hand of 8 Hits, against two opponents: 9 Hits (read
 * through the calibration ladder as sHE) and the reference field (a mixed hand; read as a
 * swing in points and converted with the field's own local slope, from a null in 9 Hits).
 * Cards are level-gated as in the game. Plus the field baselines per level.
 * `node dist/scripts/plan-catalogue.js --out plan.json [--fights 25] [--levels 1,3,5,7,12]`.
 */
import '../sim-env.js';
import '../set-env.js';
import { writeFileSync } from 'node:fs';
import { engineReady } from '@deck-monsters/engine';
import { catalogueCards, REFERENCE_FIELD_HAND } from '../balance/catalogue.js';
import type { Plan, Unit } from '../balance/units.js';

function arg(name: string, fallback: string): string {
	const i = process.argv.indexOf(name);
	return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

async function main(): Promise<void> {
	await engineReady;
	const out = arg('--out', 'plan-catalogue.json');
	const fights = Number(arg('--fights', '25'));
	const levels = arg('--levels', '1,3,5,7,12').split(',').map(Number);
	const hits = Array(9).fill('Hit') as string[];
	const opponents: Record<string, string[]> = { hits, field: [...REFERENCE_FIELD_HAND] };
	const units: Unit[] = [];
	let seed = 660_013;
	const add = (id: string, level: number, hand: string[], opponent: string, tags: Record<string, string | number>): void => {
		seed += 7919;
		units.push({
			id,
			sides: [
				{ type: 'Gladiator', level, deck: hand, chassis: 'reference' },
				{ type: 'Gladiator', level, deck: opponents[opponent]!, chassis: 'reference' },
			],
			fights,
			seed,
			tags: { level, opponent, ...tags },
		});
	};
	const withCard = (card: string, slot: number): string[] => hits.map((c, p) => (p === slot ? card : c));
	for (const level of levels) {
		for (let slot = 0; slot < 9; slot += 1) {
			for (let u = 0; u < 2; u += 1) {
				add(`cat:base:field:L${level}:hit:p${slot}:u${u}`, level, hits, 'field', { kind: 'catalogue-base', base: 'hits' });
				add(`cat:base:field:L${level}:null:p${slot}:u${u}`, level, withCard('Ideal:Null', slot), 'field', { kind: 'catalogue-base', base: 'null' });
			}
		}
		for (const card of catalogueCards()) {
			if (card.level > level) continue;
			for (const opponent of Object.keys(opponents)) {
				for (let slot = 0; slot < 9; slot += 1) {
					add(`cat:${opponent}:L${level}:${card.cardType}:p${slot}`, level, withCard(card.cardType, slot), opponent, {
						kind: 'catalogue',
						card: card.cardType,
						slot,
					});
				}
			}
		}
	}
	const plan: Plan = { name: 'card catalogue', profile: fights >= 50 ? 'full' : 'quick', units };
	writeFileSync(out, `${JSON.stringify(plan)}\n`);
	process.stdout.write(`Wrote ${units.length} units (${units.length * fights * 2} fights) to ${out}\n`);
	process.exit(0);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
