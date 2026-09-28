#!/usr/bin/env node
/**
 * Plan the catalogue contexts (roadmap 34 task 6b): every card (Flee aside) in each context
 * of `balance/contexts.ts`, on the reference chassis, in each slot, plus a Hit and a null in
 * each slot of each context as baselines. `sim-contexts` reads a card's value as
 * 1 + (score - Hit's score) / (Hit's score - null's score), in Hit-equivalents for that
 * context. `node dist/scripts/plan-contexts.js --out plan.json [--fights 25] [--levels 3,5,7]`.
 */
import '../sim-env.js';
import '../set-env.js';
import { writeFileSync } from 'node:fs';
import { engineReady } from '@deck-monsters/engine';
import { catalogueCards } from '../balance/catalogue.js';
import { CARD_CONTEXTS } from '../balance/contexts.js';
import type { Plan, Unit } from '../balance/units.js';

function arg(name: string, fallback: string): string {
	const i = process.argv.indexOf(name);
	return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

async function main(): Promise<void> {
	await engineReady;
	const out = arg('--out', 'plan-contexts.json');
	const fights = Number(arg('--fights', '25'));
	const levels = arg('--levels', '3,5,7').split(',').map(Number);
	const units: Unit[] = [];
	let seed = 990_001;
	const add = (id: string, context: string, level: number, card: string, slot: number, tags: Record<string, string | number>): void => {
		const ctx = CARD_CONTEXTS[context]!;
		const hand = [...ctx.hand];
		hand.splice(slot, 0, card);
		seed += 7919;
		units.push({
			id,
			sides: [
				{ type: 'Gladiator', level, deck: hand, chassis: 'reference' },
				...Array.from({ length: ctx.opponents }, () => ({ type: 'Gladiator' as const, level, deck: [...ctx.opponent], chassis: 'reference' as const })),
			],
			// A crowd plays every seat order, so each rotation gets fewer fights for a similar total.
			fights: ctx.opponents > 1 ? Math.max(1, Math.round((fights * 2) / (ctx.opponents + 1))) : fights,
			seed,
			tags: { context, level, card, slot, ...tags },
		});
	};
	for (const context of Object.keys(CARD_CONTEXTS)) {
		for (const level of levels) {
			for (let slot = 0; slot < 9; slot += 1) {
				for (let u = 0; u < 3; u += 1) {
					add(`ctx:base:${context}:L${level}:hit:p${slot}:u${u}`, context, level, 'Hit', slot, { kind: 'context-base', base: 'hit' });
					add(`ctx:base:${context}:L${level}:null:p${slot}:u${u}`, context, level, 'Ideal:Null', slot, { kind: 'context-base', base: 'null' });
				}
			}
			for (const card of catalogueCards()) {
				if (card.level > level || card.cardType === 'Hit') continue;
				for (let slot = 0; slot < 9; slot += 1) {
					add(`ctx:${context}:L${level}:${card.cardType}:p${slot}`, context, level, card.cardType, slot, { kind: 'context' });
				}
			}
		}
	}
	const plan: Plan = { name: 'catalogue contexts', profile: 'quick', units };
	writeFileSync(out, `${JSON.stringify(plan)}\n`);
	const total = units.reduce((a, u) => a + u.fights * u.sides.length, 0);
	process.stdout.write(`${units.length} units, ${total} fights -> ${out}\n`);
	process.exit(0);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
