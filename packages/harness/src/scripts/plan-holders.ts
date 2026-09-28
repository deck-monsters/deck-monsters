#!/usr/bin/env node
/**
 * Plan Layer 3's fights (roadmap 34 task 7). Two kinds of unit:
 * - `chassis`: each monster, with the reference field hand, against the reference chassis
 *   holding the same hand. What the body is worth with the hand held fixed.
 * - `holder`: each card that only some monsters can hold, on each real monster that can hold
 *   it, in each slot of 8 Hits, against the same monster with 9 Hits (a mirror). The card's
 *   value on its real holder, type bonuses and stats included, to set beside its
 *   reference-chassis value in the catalogue.
 * `node dist/scripts/plan-holders.js --out plan.json [--fights 25] [--chassis-levels 0,1,2,3,4,5,6,7,10,12]
 *  [--levels 1,3,5,7]`.
 */
import '../sim-env.js';
import '../set-env.js';
import { writeFileSync } from 'node:fs';
import { engineReady } from '@deck-monsters/engine';
import { catalogueCards, REFERENCE_FIELD_HAND } from '../balance/catalogue.js';
import { holdableCardTypes } from '../balance/holders.js';
import { SIM_MONSTER_TYPES } from '../simulate.js';
import type { Plan, Unit } from '../balance/units.js';

function arg(name: string, fallback: string): string {
	const i = process.argv.indexOf(name);
	return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

async function main(): Promise<void> {
	await engineReady;
	const out = arg('--out', 'plan-holders.json');
	const fights = Number(arg('--fights', '25'));
	const chassisLevels = arg('--chassis-levels', '0,1,2,3,4,5,6,7,10,12').split(',').map(Number);
	const levels = arg('--levels', '1,3,5,7').split(',').map(Number);
	const hits = Array(9).fill('Hit') as string[];
	const field = [...REFERENCE_FIELD_HAND];
	const cards = new Map(catalogueCards().map(c => [c.cardType, c]));
	const units: Unit[] = [];
	let seed = 770_017;

	for (const type of SIM_MONSTER_TYPES) {
		for (const level of chassisLevels) {
			for (let u = 0; u < 6; u += 1) {
				seed += 7919;
				units.push({
					id: `chassis:${type}:L${level}:u${u}`,
					sides: [
						{ type, level, deck: field },
						{ type: 'Gladiator', level, deck: field, chassis: 'reference' },
					],
					fights,
					seed,
					tags: { kind: 'chassis', type, level },
				});
			}
		}
		for (const level of levels) {
			for (const cardType of holdableCardTypes(type, level)) {
				const card = cards.get(cardType)!;
				if (card.holders === 'any' || card.level > level) continue;
				for (let slot = 0; slot < 9; slot += 1) {
					seed += 7919;
					units.push({
						id: `holder:${type}:L${level}:${cardType}:p${slot}`,
						sides: [
							{ type, level, deck: hits.map((c, p) => (p === slot ? cardType : c)) },
							{ type, level, deck: hits },
						],
						fights,
						seed,
						tags: { kind: 'holder', type, level, card: cardType, slot },
					});
				}
			}
		}
	}
	const plan: Plan = { name: 'layer 3: chassis and holders', profile: 'quick', units };
	writeFileSync(out, `${JSON.stringify(plan)}\n`);
	const total = units.reduce((a, u) => a + u.fights * u.sides.length, 0);
	process.stdout.write(`${units.length} units, ${total} fights -> ${out}\n`);
	process.exit(0);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
