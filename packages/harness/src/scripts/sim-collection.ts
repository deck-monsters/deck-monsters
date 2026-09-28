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
 * card), against the unconstrained best: any card it can hold, same copy limit. Those sums use
 * the Hit-context sHE, as the Layer 3 report states.
 *
 * The typical hand, which `sim-search` starts from, is picked differently (a Codex review of
 * #409, and rule 4 of "Value beyond damage" in roadmap 34):
 * - with `--contexts <contexts.json>`, a card the context report flags as a context card is
 *   ranked by its best duel context, so a synergy card (Feline Companion in a caster hand) is
 *   not ranked by the Hit context's blind spot;
 * - with at most 2 heals, since heals do not stack (the first search's level-5 starting hands
 *   held five, and 14 of its 17 kept moves swapped one out).
 */
import '../sim-env.js';
import '../set-env.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { MAX_CARD_COPIES_IN_HAND, drawCard, engineReady, getInitialDeck, getXpCapForLevel } from '@deck-monsters/engine';
import { buildHolder, holdableCardTypes } from '../balance/holders.js';
import { SIM_MONSTER_TYPES } from '../simulate.js';
import { mulberry32 } from '../rng.js';
import { CARD_CONTEXTS } from '../balance/contexts.js';

function arg(name: string, fallback: string): string {
	const i = process.argv.indexOf(name);
	return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

interface CatalogueJson {
	levels: number[];
	cards: Array<{ cardType: string; label: string; actionClass: string; she: Record<string, number> }>;
}
interface ContextsJson {
	cards: Array<{ cardType: string; means: Record<string, number>; flags: string[] }>;
}
/** Heals in a typical hand. */
const TYPICAL_HAND_MAX_HEALS = 2;

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
	const contextsPath = arg('--contexts', '');
	const contexts = contextsPath ? (JSON.parse(readFileSync(contextsPath, 'utf8')) as ContextsJson) : undefined;
	const duelContexts = Object.keys(CARD_CONTEXTS).filter(c => CARD_CONTEXTS[c]!.opponents === 1);
	/**
	 * A card's value for picking a typical hand. A card the context report flags as a context
	 * card uses its best duel context (averaged over the measured levels); every other card
	 * keeps sHE. Taking the best of four noisy per-level readings for every card put three
	 * Delayed Hits in every level-5 hand, so only a flagged gain counts.
	 */
	const pickValue = (cardType: string, level: number): number => {
		const she = sheAt(cardType, level);
		const card = contexts?.cards.find(c => c.cardType === cardType);
		if (!card?.flags.some(f => f.startsWith('context card'))) return she;
		const values = duelContexts.map(c => card.means[c]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
		return Math.max(she, ...values);
	};
	const isHeal = (cardType: string): boolean => catalogue.cards.find(c => c.cardType === cardType)?.actionClass === 'heal';
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
					// The game awards the fight's XP before the winner's card is drawn
					// (Ring.fightConcludes, then ring.win), so a level-crossing win draws from the new
					// level's pool (a Codex review of #409).
					m.xp = (f + 1) * xpPerFight;
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
			const typicalPool = perCard.filter(c => c.share >= 0.5).flatMap(c =>
				Array.from({ length: Math.min(MAX_CARD_COPIES_IN_HAND, Math.max(1, Math.round(c.meanCopies))) }, () => ({ card: c.card, she: pickValue(c.card, level) })),
			);
			const typical: Array<{ card: string; she: number }> = [];
			let heals = 0;
			for (const slot of typicalPool.sort((a, b) => b.she - a.she)) {
				if (typical.length >= 9) break;
				if (isHeal(slot.card)) {
					if (heals >= TYPICAL_HAND_MAX_HEALS) continue;
					heals += 1;
				}
				typical.push(slot);
			}
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
