#!/usr/bin/env node
/**
 * Layer 3's collection model (roadmap 34 task 7), with no fights: what a typical player owns
 * by each level, drawn with the engine's own starting deck and drop code, and the inventory
 * that gives each monster.
 * `node dist/scripts/sim-collection.js --catalogue <catalogue.json> [--players 200]
 *  [--xp-per-fight 9] [--win-rate 0.5] [--levels 0,1,2,3,4,5,6,7,10,12] [--json out.json]`.
 *
 * A player starts with `getInitialDeck` (every signature card is in it) and gains one drop a
 * win from `drawCard` with the monster as it is at that fight: the level gate and the early
 * drop boost are the engine's. The monster earns `--xp-per-fight` (production, 2026-09-28:
 * about 9 at levels 1-3). Shop purchases are left out, so this is a floor on what a player
 * owns. One monster per player, fighting every fight.
 *
 * The inventory is the best 9 cards the monster can hold from that collection, by the
 * catalogue's sHE at the nearest measured level (at most `MAX_CARD_COPIES_IN_HAND` copies of a
 * card), against the unconstrained best: any card it can hold, same copy limit.
 */
import '../sim-env.js';
import '../set-env.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { MAX_CARD_COPIES_IN_HAND, drawCard, engineReady, getInitialDeck, getXpCapForLevel } from '@deck-monsters/engine';
import { buildHolder, holdableCardTypes } from '../balance/holders.js';
import { SIM_MONSTER_TYPES } from '../simulate.js';
import { mulberry32 } from '../rng.js';

function arg(name: string, fallback: string): string {
	const i = process.argv.indexOf(name);
	return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

interface CatalogueJson {
	levels: number[];
	cards: Array<{ cardType: string; label: string; she: Record<string, number> }>;
}

async function main(): Promise<void> {
	await engineReady;
	Math.random = mulberry32(34_007);
	const players = Number(arg('--players', '200'));
	const xpPerFight = Number(arg('--xp-per-fight', '9'));
	const winRate = Number(arg('--win-rate', '0.5'));
	const levels = arg('--levels', '0,1,2,3,4,5,6,7,10,12').split(',').map(Number);
	const catalogue = JSON.parse(readFileSync(arg('--catalogue', ''), 'utf8')) as CatalogueJson;
	const nearest = (level: number): number => catalogue.levels.reduce((a, b) => (Math.abs(b - level) < Math.abs(a - level) ? b : a));
	const sheAt = (cardType: string, level: number): number => {
		const card = catalogue.cards.find(c => c.cardType === cardType);
		const at = card?.she[String(nearest(level))];
		// A card not measured at the nearest level (level-gated there): take its lowest measured level.
		return at ?? card?.she[String(Math.min(...Object.keys(card?.she ?? {}).map(Number)))] ?? 0;
	};
	const label = (cardType: string): string => catalogue.cards.find(c => c.cardType === cardType)?.label ?? cardType;
	const fightsTo = (level: number): number => (level <= 0 ? 0 : Math.ceil((getXpCapForLevel(level - 1) + 1) / xpPerFight));

	/** Best 9 by sHE from `owned` counts, up to the copy limit each. */
	const best9 = (owned: Map<string, number>, level: number): Array<{ card: string; she: number }> => {
		const slots: Array<{ card: string; she: number }> = [];
		for (const [card, n] of owned) {
			for (let i = 0; i < Math.min(n, MAX_CARD_COPIES_IN_HAND); i += 1) slots.push({ card, she: sheAt(card, level) });
		}
		return slots.sort((a, b) => b.she - a.she).slice(0, 9);
	};
	const sum = (xs: Array<{ she: number }>): number => xs.reduce((a, x) => a + x.she, 0);

	const output: Record<string, Record<number, unknown>> = {};
	process.stdout.write(`Collection model: ${players} players per monster, ${xpPerFight} XP a fight, ${Math.round(winRate * 100)}% wins, no shop.\n`);
	process.stdout.write(`Fights to reach each level: ${levels.map(l => `L${l} ${fightsTo(l)}`).join(', ')}\n\n`);
	for (const type of SIM_MONSTER_TYPES) {
		output[type] = {};
		for (const level of levels) {
			const holdable = new Set(holdableCardTypes(type, level).filter(c => catalogue.cards.some(k => k.cardType === c)));
			const copies = new Map<string, number[]>();
			const inventories: number[] = [];
			const cardsOwned: number[] = [];
			for (let p = 0; p < players; p += 1) {
				const { monster, character } = buildHolder(type, 0);
				const owned: Array<{ cardType?: string }> = [...(getInitialDeck({}, character) as Array<{ cardType?: string }>)];
				const target = fightsTo(level);
				const m = monster as unknown as { xp: number };
				for (let f = 0; f < target; f += 1) {
					m.xp = f * xpPerFight;
					if (Math.random() < winRate) owned.push(drawCard({}, monster) as { cardType?: string });
				}
				monster.disposeTimers();
				character.disposeTimers?.();
				const counts = new Map<string, number>();
				for (const card of owned) {
					if (card.cardType && holdable.has(card.cardType)) counts.set(card.cardType, (counts.get(card.cardType) ?? 0) + 1);
				}
				for (const card of holdable) (copies.get(card) ?? copies.set(card, []).get(card)!).push(counts.get(card) ?? 0);
				inventories.push(sum(best9(counts, level)));
				cardsOwned.push(owned.length);
			}
			const unconstrained = best9(new Map([...holdable].map(c => [c, MAX_CARD_COPIES_IN_HAND])), level);
			const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
			const perCard = [...copies].map(([card, xs]) => ({ card, meanCopies: mean(xs), share: xs.filter(x => x > 0).length / xs.length, she: sheAt(card, level) }));
			const typical = best9(new Map(perCard.filter(c => c.share >= 0.5).map(c => [c.card, Math.max(1, Math.round(c.meanCopies))])), level);
			output[type]![level] = {
				fights: fightsTo(level),
				meanCardsOwned: mean(cardsOwned),
				inventoryHE: mean(inventories),
				typicalHand: typical.map(t => t.card),
				unconstrainedHE: sum(unconstrained),
				unconstrainedHand: unconstrained.map(t => t.card),
				cards: perCard,
			};
			process.stdout.write(`${type.padEnd(13)} L${String(level).padEnd(3)} owns ${mean(cardsOwned).toFixed(0).padStart(4)} cards; best 9 worth ${mean(inventories).toFixed(1).padStart(5)} HE (unconstrained ${sum(unconstrained).toFixed(1).padStart(5)}); typical best: ${typical.slice(0, 4).map(t => `${label(t.card)} ${t.she.toFixed(1)}`).join(', ')}\n`);
		}
	}
	const jsonOut = arg('--json', '');
	if (jsonOut) writeFileSync(jsonOut, `${JSON.stringify({ players, xpPerFight, winRate, levels, monsters: output }, null, 1)}\n`);
	process.exit(0);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
