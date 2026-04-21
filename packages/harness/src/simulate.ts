/**
 * Programmatic N-fight simulation for balance / mechanics validation.
 * Import `./set-env.js` before this module loads the engine.
 */

import type { Game, GameEvent } from '@deck-monsters/engine';
import {
	allMonsters,
	createTestGame,
	engineReady,
	getCardClassByTypeName,
	randomContestant,
	type Contestant,
} from '@deck-monsters/engine';
import { getXpCapForLevel } from './xp-for-level.js';

/** Monotonic id so concurrent `simulate()` calls never share eventBus subscriber keys. */
let harnessSimRunSeq = 0;

export type SimMonsterType = 'Basilisk' | 'Gladiator' | 'Jinn' | 'Minotaur' | 'WeepingAngel';

export interface SimMonsterSpec {
	type: SimMonsterType | string;
	level: number;
	/** Card type names matching engine static `cardType` (e.g. "Hit", "Heal"). */
	deck?: string[];
	/** Varies boss `randomCharacter` battle record for stat diversity. */
	statSeed?: number;
}

export interface SimConfig {
	monsters: SimMonsterSpec[];
	fights: number;
	seed?: number;
	/** Passed to createTestGame as roomId prefix. */
	roomId?: string;
}

export interface SimResult {
	fights: number;
	winRates: Record<string, number>;
	drawRate: number;
	avgRounds: number;
	avgDamagePerCard: Record<string, number>;
	cardDropRate: number;
}

interface FightResolvedPayload {
	rounds?: number;
	outcome?: string;
	participants?: Array<{ monsterName: string; outcome: string }>;
}

function mulberry32(a: number): () => number {
	return () => {
		let t = (a += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const MONSTER_TYPES: Record<string, SimMonsterType> = {
	basilisk: 'Basilisk',
	gladiator: 'Gladiator',
	jinn: 'Jinn',
	minotaur: 'Minotaur',
	weepingangel: 'WeepingAngel',
	'weeping angel': 'WeepingAngel',
};

export function parseMonsterType(raw: string): SimMonsterType {
	const key = raw.trim().toLowerCase().replace(/\s+/g, '');
	const mapped = MONSTER_TYPES[key];
	if (mapped) return mapped;
	const pascal = raw
		.trim()
		.replace(/(?:^|\s|-)(\w)/g, (_, c: string) => c.toUpperCase())
		.replace(/\s|-/g, '');
	const allowed: SimMonsterType[] = ['Basilisk', 'Gladiator', 'Jinn', 'Minotaur', 'WeepingAngel'];
	if ((allowed as string[]).includes(pascal)) return pascal as SimMonsterType;
	throw new Error(`Unknown monster type: "${raw}" (expected one of: ${allowed.join(', ')})`);
}

function monsterClassFor(spec: SimMonsterType): new (options?: Record<string, unknown>) => unknown {
	const Found = allMonsters.find(M => (M as unknown as { name: string }).name === spec);
	if (!Found) throw new Error(`Monster class not found: ${spec}`);
	return Found as new (options?: Record<string, unknown>) => unknown;
}

function buildContestant(
	spec: SimMonsterType,
	level: number,
	deckNames: string[] | undefined,
	statSeed: number | undefined,
	fightIndex: number,
): Contestant {
	const MonsterClass = monsterClassFor(spec);
	const xp = getXpCapForLevel(level);
	const seedPart = statSeed !== undefined ? statSeed + fightIndex : undefined;
	const battles =
		seedPart !== undefined
			? { total: 40, wins: Math.abs(seedPart) % 41, losses: 0 }
			: undefined;
	if (battles) battles.losses = battles.total - battles.wins;

	const contestant = randomContestant({
		isBoss: true,
		Monsters: [MonsterClass],
		xp,
		...(battles ? { battles } : {}),
	});

	if (deckNames?.length) {
		type CardCtor = new () => { cardType?: string; name?: string; play?: (...args: unknown[]) => unknown };
		contestant.monster.cards = deckNames.map(n => new (getCardClassByTypeName(n) as CardCtor)());
	}

	return contestant;
}

function installHitDamageCapture(
	contestants: Contestant[],
	sums: Map<string, { total: number; count: number }>,
): () => void {
	type HitMonster = {
		on(event: string, fn: (...args: unknown[]) => void): (...args: unknown[]) => void;
		off(event: string, fn: (...args: unknown[]) => void): void;
	};
	const listeners: Array<{ monster: HitMonster; bound: (...args: unknown[]) => void }> = [];

	for (const { monster } of contestants) {
		const m = monster as HitMonster;
		const bound = m.on(
			'hit',
			(_className: string, _self: unknown, ev: { card?: { cardType?: string; name?: string }; damage?: number }) => {
				const dmg = typeof ev?.damage === 'number' ? ev.damage : 0;
				if (dmg <= 0) return;
				const card = ev?.card;
				const key = (card?.cardType || card?.name || 'unknown') as string;
				const cur = sums.get(key) ?? { total: 0, count: 0 };
				cur.total += dmg;
				cur.count += 1;
				sums.set(key, cur);
			},
		);
		listeners.push({ monster: m, bound });
	}

	return () => {
		for (const { monster: mon, bound } of listeners) {
			mon.off('hit', bound);
		}
	};
}

function aggregateDamagePerCard(sums: Map<string, { total: number; count: number }>): Record<string, number> {
	const out: Record<string, number> = {};
	for (const [name, { total, count }] of sums) {
		out[name] = count > 0 ? total / count : 0;
	}
	return out;
}

/**
 * Run `config.fights` ring encounters with the given monster lineup (2+ monsters).
 * Reuses one `Game` for the whole batch (fast) while registering each fight's characters
 * on `game.characters` so global listeners stay room-scoped.
 */
export async function simulate(config: SimConfig): Promise<SimResult> {
	const { monsters, fights, seed, roomId = 'harness-sim' } = config;
	const subscriberRunId = ++harnessSimRunSeq;
	if (monsters.length < 2) {
		throw new Error('simulate() requires at least 2 monsters');
	}
	if (fights < 1 || !Number.isFinite(fights)) {
		throw new Error('simulate() requires fights >= 1');
	}

	const prevRandom = Math.random;
	if (seed !== undefined) {
		Math.random = mulberry32(seed);
	}

	// `engineReady` loads lazy helpers that call `Math.random` (names, colors, `draw()`, …).
	// Those draws must be part of the seeded stream so two runs with the same `--seed`
	// burn identical RNG prefixes before the first fight.
	await engineReady;

	const names = monsters.map((_, i) => `Sim ${i + 1}`);
	const winCounts = new Map<string, number>();
	for (const n of names) winCounts.set(n, 0);
	let draws = 0;
	let roundSum = 0;
	let cardDrops = 0;
	const damageSums = new Map<string, { total: number; count: number }>();

	const game: Game = createTestGame(`${roomId}-batch`, { characters: {} });
	const ring = game.getRing();

	const unsubFight = game.eventBus.subscribe(`sim-fight:${subscriberRunId}:${roomId}`, {
		deliver(ev: GameEvent) {
			if (ev.type !== 'ring.fightResolved') return;
			const p = ev.payload as FightResolvedPayload;
			const rounds = typeof p.rounds === 'number' ? p.rounds : 0;
			roundSum += rounds;
			if (p.outcome === 'draw') {
				draws += 1;
				return;
			}
			const parts = p.participants ?? [];
			for (const part of parts) {
				if (part.outcome === 'win') {
					winCounts.set(part.monsterName, (winCounts.get(part.monsterName) ?? 0) + 1);
				}
			}
		},
	});

	const unsubDrop = game.eventBus.subscribe(`sim-drop:${subscriberRunId}:${roomId}`, {
		deliver(ev: GameEvent) {
			if (ev.type === 'ring.cardDrop' && ev.scope === 'public') cardDrops += 1;
		},
	});

	const charMap = game as unknown as { characters: Record<string, unknown> };

	try {
		for (let f = 0; f < fights; f++) {
			ring.clearRing();

			const contestants = monsters.map((m, i) => {
				const type = typeof m.type === 'string' ? parseMonsterType(m.type) : (m.type as SimMonsterType);
				const c = buildContestant(type, m.level, m.deck, m.statSeed, f);
				c.monster.setOptions({
					name: names[i]!,
					stableId: `harness-sim-${roomId}-${f}-m${i}`,
				});
				return c;
			});

			const simUserIds: string[] = [];
			for (let i = 0; i < contestants.length; i++) {
				const uid = `sim-${subscriberRunId}-${f}-${i}`;
				simUserIds.push(uid);
				const c = contestants[i]!;
				c.userId = uid;
				charMap.characters[uid] = c.character;
			}

			for (const c of contestants) {
				ring.addMonster({
					monster: c.monster,
					character: c.character,
					userId: c.userId,
					isBoss: c.isBoss,
				});
			}

			const removeHitListeners = installHitDamageCapture(contestants, damageSums);

			try {
				await ring.fight();
			} finally {
				removeHitListeners();
				for (const uid of simUserIds) {
					delete charMap.characters[uid];
				}
			}
		}
	} finally {
		unsubFight();
		unsubDrop();
		game.dispose();
		Math.random = prevRandom;
	}

	const winRates: Record<string, number> = {};
	for (const n of names) {
		winRates[n] = fights > 0 ? ((winCounts.get(n) ?? 0) / fights) * 100 : 0;
	}

	return {
		fights,
		winRates,
		drawRate: fights > 0 ? (draws / fights) * 100 : 0,
		avgRounds: fights > 0 ? roundSum / fights : 0,
		avgDamagePerCard: aggregateDamagePerCard(damageSums),
		cardDropRate: fights > 0 ? cardDrops / fights : 0,
	};
}

export function simMonsterLineup(monsters: SimMonsterSpec[]): string {
	return monsters.map(m => `${parseMonsterType(String(m.type))}:${m.level}`).join(',');
}

export function parseMonstersArg(arg: string): SimMonsterSpec[] {
	return arg.split(',').map(part => {
		const [typeRaw, levelRaw] = part.split(':').map(s => s.trim());
		if (!typeRaw || levelRaw === undefined || levelRaw === '') {
			throw new Error(`Invalid monster entry "${part}" (expected Type:level)`);
		}
		const level = Number(levelRaw);
		if (!Number.isFinite(level) || level < 0) throw new Error(`Invalid level in "${part}"`);
		return { type: parseMonsterType(typeRaw), level: Math.floor(level) };
	});
}
