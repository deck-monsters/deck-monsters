#!/usr/bin/env node
/**
 * Records "feed lab" fixtures: `node dist/scripts/record-feed-fixture.js [name ...]`.
 *
 * Each fixture is the exact stream of `GameEvent`s one room member receives on the `ringFeed`
 * subscription during real engine fights (public events plus the private ones addressed to that
 * member), with the time each event arrived. `apps/web/src/lab/fixtures/*.json` replays them into
 * the real Ring and Console feed components with no server, so a browser suite can test
 * scrolling against production-shaped traffic.
 *
 * How the timing is real: the engine runs with its production pacing (`DECK_MONSTERS_SKIP_DELAYS`
 * is NOT set) on a virtual clock (`record-feed-clock.ts`), so every pause comes from the same
 * delay functions and `remainingGapMs` arithmetic production uses, in milliseconds of wall time.
 * The fight starts when the ring's own 60 s countdown timer fires, not from a direct
 * `ring.fight()` call.
 *
 * Differences from production, all deliberate and listed in each fixture's description:
 * - The 60 s pre-fight countdown is compressed to 3 s (`compressCountdowns`); events and payload
 *   timestamps inside and after it are remapped to match.
 * - Event ids keep the real `${epochMs}-${suffix}` shape, but the suffix is the event's index in
 *   8 hex digits (production's is random) and the epoch starts at `BASE_EPOCH_MS`, so a re-run
 *   is byte-identical. Events in the same millisecond are nudged apart by 1 ms so ids strictly
 *   increase.
 * - The synthetic `handshake` frame the subscription yields first is not an engine event and is
 *   not recorded.
 *
 * Each fixture runs in its own child process with a fixed `Math.random` seed, so the files do not
 * depend on run order, and all of them are produced in parallel.
 */

import '../sim-env.js';
import '../set-env.js';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	createTestGame,
	drawCard,
	engineReady,
	getCardClassByTypeName,
	getInitialDeck,
	getXpCapForLevel,
	MAX_CARD_COPIES_IN_HAND,
	randomContestant,
	allMonsters,
	type Contestant,
	type Game,
	type GameEvent,
} from '@deck-monsters/engine';
import { mulberry32 } from '../rng.js';
import { LIKELY_DECKS } from '../likely-decks.js';
import { installVirtualClock, type VirtualClock } from './record-feed-clock.js';

/** Every fixture shares one room id (a fixed valid uuid). */
export const FIXTURE_ROOM_ID = '00000000-0000-4000-8000-0000000001ab';
/** 2026-01-01T00:00:00Z. The first event of every fixture has this epoch in its id. */
export const BASE_EPOCH_MS = 1767225600000;
const FIGHT_COUNTDOWN_MS = 60_000;
/** What the 60 s pre-fight countdown is shortened to in the recording. */
const COUNTDOWN_REPLAY_MS = 3_000;
/** `RECORD_FEED_OUT` redirects the files (seed hunting writes to a scratch directory). */
const OUT_DIR =
	process.env.RECORD_FEED_OUT ??
	resolve(dirname(fileURLToPath(import.meta.url)), '../../../../apps/web/src/lab/fixtures');
const MAX_FIGHT_VIRTUAL_MS = 45 * 60_000;

const userIdFor = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** What a spec's `run` gets to drive. */
interface Rig {
	game: Game;
	ring: ReturnType<Game['getRing']>;
	clock: VirtualClock;
	viewerUserId: string;
	/** Builds a player's monster as a player would equip it: signature cards first, then a fill. */
	makePlayer(type: string, level: number, index: number): Contestant;
	/** Puts a player in the ring the prompt-free way the harness does, and lets the engine react. */
	join(contestant: Contestant, afterMs?: number): Promise<void>;
	/** Waits (virtually) for the countdown to end and the fight to finish, plus the tail of the feed. */
	playFight(): Promise<void>;
}

interface FixtureSpec {
	name: string;
	description: string;
	seed: number;
	viewerIndex: number;
	run(rig: Rig): Promise<void>;
}

interface RecordedEvent {
	/** The event as published, snapshotted at delivery so later mutation cannot change it. */
	data: GameEvent;
	/** Virtual time of delivery. */
	ts: number;
}

const FIXTURES: FixtureSpec[] = [
	{
		name: 'quiet-room',
		description:
			'A monster enters an empty ring, is told the countdown waits for one more, and a second joins and starts the countdown; recording stops before the fight. The 60 s countdown is not played out.',
		seed: 1101,
		viewerIndex: 1,
		async run({ makePlayer, join, clock }) {
			await join(makePlayer('Minotaur', 5, 1));
			await clock.advance(14_000);
			await join(makePlayer('Basilisk', 4, 2));
			await clock.advance(2_000);
		},
	},
	{
		name: 'duel',
		description:
			'Two player monsters, one fight from entry to results. The 60 s pre-fight countdown is compressed to 3 s.',
		seed: 8,
		viewerIndex: 1,
		async run({ makePlayer, join, playFight }) {
			await join(makePlayer('Gladiator', 5, 1));
			await join(makePlayer('Jinn', 5, 2), 9_000);
			await playFight();
		},
	},
	{
		name: 'brawl',
		description:
			'Eight player monsters of levels 3 to 8 in one free-for-all (the ring rolled Blood Feud), entry to results, ring events at their normal chance. The 60 s pre-fight countdown is compressed to 3 s.',
		seed: 3,
		viewerIndex: 1,
		async run({ makePlayer, join, playFight }) {
			const roster: Array<[string, number]> = [
				['Dragon', 7],
				['Minotaur', 6],
				['Jinn', 5],
				['WeepingAngel', 6],
				['Gladiator', 5],
				['Unicorn', 8],
				['Basilisk', 4],
				['Minotaur', 3],
			];
			for (const [i, [type, level]] of roster.entries()) {
				await join(makePlayer(type, level, i + 1), i === 0 ? 0 : 5_000 + i * 700);
			}
			await playFight();
		},
	},
	{
		name: 'boss',
		description:
			'One player monster and a boss the ring spawns, from the boss arrival announcement to the result. The 60 s pre-fight countdown is compressed to 3 s.',
		seed: 4,
		viewerIndex: 1,
		async run({ makePlayer, join, playFight, ring, clock }) {
			await join(makePlayer('Dragon', 6, 1));
			await clock.advance(8_000);
			const boss = ring.spawnBoss();
			if (!boss) throw new Error('record-feed: the ring did not accept a boss');
			// A creature's stable id is a random uuid until set; pin it so the file is reproducible.
			boss.monster.setOptions({ stableId: 'feed-fixture-boss' });
			await playFight();
		},
	},
	{
		name: 'long-session',
		description:
			'Three back-to-back fights in one room (three players, then four, then three again, with the monsters recovered between fights), for soak tests. Each 60 s pre-fight countdown is compressed to 3 s.',
		seed: 5505,
		viewerIndex: 1,
		async run({ makePlayer, join, playFight, clock, ring }) {
			const players = [
				makePlayer('Jinn', 4, 1),
				makePlayer('Unicorn', 5, 2),
				makePlayer('Minotaur', 4, 3),
				makePlayer('WeepingAngel', 5, 4),
			];
			const recover = (c: Contestant): void => {
				const monster = c.monster as unknown as {
					respawn(immediate?: boolean): number;
					hp: number;
					maxHp: number;
					dead: boolean;
				};
				if (monster.dead) monster.respawn(true);
			};
			const rounds: number[][] = [[0, 1, 2], [0, 1, 2, 3], [0, 2, 3]];
			for (const [round, picks] of rounds.entries()) {
				for (const [i, pick] of picks.entries()) {
					const player = players[pick]!;
					recover(player);
					await clock.advance(1);
					(player.monster as unknown as { hp: number; maxHp: number }).hp = (
						player.monster as unknown as { maxHp: number }
					).maxHp;
					await join(player, round === 0 && i === 0 ? 0 : 4_000 + i * 900);
				}
				await playFight();
				// The 30 s tail in `playFight` is the players reading the results; a beat more, then they walk back to the ring.
				await clock.advance(5_000);
				if (ring.contestants.length > 0) ring.clearRing();
			}
		},
	},
];

// ---------------------------------------------------------------------------
// Building a player the way the harness's `buildHuman` does
// ---------------------------------------------------------------------------

type CardCtor = new () => { cardType?: string };

function buildPlayer(type: string, level: number, index: number): Contestant {
	const MonsterClass = allMonsters.find(M => (M as unknown as { name: string }).name === type);
	if (!MonsterClass) throw new Error(`record-feed: unknown monster ${type}`);
	const contestant = randomContestant({
		isBoss: false,
		Monsters: [MonsterClass],
		xp: getXpCapForLevel(level),
	});
	const { monster, character } = contestant as unknown as {
		monster: {
			level: number;
			cardSlots: number;
			cards: Array<{ cardType?: string }>;
			canHoldCard(card: unknown): boolean;
			setOptions(options: Record<string, unknown>): void;
		};
		character: { coins: number; lastDailyFightCoinDay?: number; battles: unknown };
	};
	// A stable id: the default is a random uuid, which would make the file differ between runs.
	monster.setOptions({ stableId: `feed-fixture-m${index}` });

	const eligible = {
		level: monster.level,
		canHoldCard: (Card: { cardType?: string }) => Card.cardType !== 'Flee' && monster.canHoldCard(Card),
	};
	const pool = [
		...(getInitialDeck({}, character) as Array<{ cardType?: string }>),
		...Array.from({ length: level * 2 }, () => drawCard({}, eligible)),
	].filter(card => card.cardType !== 'Flee' && monster.canHoldCard(card));
	const preferred: Array<{ cardType?: string }> = [];
	for (const name of LIKELY_DECKS[type] ?? []) {
		if (preferred.length >= monster.cardSlots) break;
		const card = new (getCardClassByTypeName(name) as CardCtor)();
		if (monster.canHoldCard(card)) preferred.push(card);
	}
	const counts = new Map<string, number>();
	const hand: Array<{ cardType?: string }> = [];
	const take = (card: { cardType?: string }): void => {
		const key = card.cardType ?? '';
		if (hand.length >= monster.cardSlots || (counts.get(key) ?? 0) >= MAX_CARD_COPIES_IN_HAND) return;
		counts.set(key, (counts.get(key) ?? 0) + 1);
		hand.push(card);
	};
	const shuffledPool = [...pool];
	for (let i = shuffledPool.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffledPool[i], shuffledPool[j]] = [shuffledPool[j]!, shuffledPool[i]!];
	}
	for (const card of [...preferred, ...shuffledPool]) take(card);
	for (let tries = 0; hand.length < monster.cardSlots && tries < 200; tries += 1) {
		const card = drawCard({}, eligible);
		if (card) take(card);
	}
	monster.cards = hand;
	contestant.userId = userIdFor(index);
	return contestant;
}

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

async function record(spec: FixtureSpec): Promise<void> {
	// Production pacing: delays are NOT skipped. The virtual clock makes them instant.
	delete process.env.DECK_MONSTERS_SKIP_DELAYS;
	await engineReady;
	// `RECORD_FEED_SEED` is for hunting a better seed; committed fixtures use the spec's own.
	Math.random = mulberry32(Number(process.env.RECORD_FEED_SEED ?? spec.seed));
	const clock = installVirtualClock(BASE_EPOCH_MS);

	const game = createTestGame(FIXTURE_ROOM_ID, { characters: {} });
	const ring = game.getRing();
	const viewerUserId = userIdFor(spec.viewerIndex);
	const recorded: RecordedEvent[] = [];
	let fightsStarted = 0;
	let fightsResolved = 0;

	// Same filter as the server's `ringFeed`: no `includePrivate`, so the bus delivers public
	// events and those addressed to this user. The payload is snapshotted now because
	// `ring.fight` carries live contestant objects.
	game.eventBus.subscribe(`feed-fixture:${viewerUserId}`, {
		userId: viewerUserId,
		deliver(event: GameEvent) {
			recorded.push({ data: JSON.parse(JSON.stringify(event)) as GameEvent, ts: event.timestamp });
			if (event.type === 'ring.fight') fightsStarted += 1;
			if (event.type === 'ring.fightResolved') fightsResolved += 1;
		},
	});

	const charMap = game as unknown as { characters: Record<string, unknown> };
	const rig: Rig = {
		game,
		ring,
		clock,
		viewerUserId,
		makePlayer: (type, level, index) => {
			const contestant = buildPlayer(type, level, index);
			charMap.characters[contestant.userId] = contestant.character;
			return contestant;
		},
		async join(contestant, afterMs = 0) {
			if (afterMs > 0) await clock.advance(afterMs);
			ring.addMonster({
				monster: contestant.monster,
				character: contestant.character,
				userId: contestant.userId,
				isBoss: contestant.isBoss,
			});
			await clock.settle();
		},
		async playFight() {
			const target = fightsResolved + 1;
			await clock.runUntil(() => fightsResolved >= target && !ring.inEncounter, MAX_FIGHT_VIRTUAL_MS);
			// The results, XP and card drop arrive after `ring.fightResolved`; let that tail land.
			await clock.advance(30_000);
		},
	};

	await spec.run(rig);
	await clock.settle();
	void fightsStarted;

	const events = remap(recorded);
	const fixture = {
		name: spec.name,
		description: spec.description,
		viewerUserId,
		roomId: FIXTURE_ROOM_ID,
	};
	const body = events
		.map(e => `\t\t{"id":${JSON.stringify(e.id)},"atMs":${e.atMs},"data":${JSON.stringify(e.data)}}`)
		.join(',\n');
	const text =
		'{\n' +
		Object.entries(fixture)
			.map(([key, value]) => `\t${JSON.stringify(key)}: ${JSON.stringify(value)},\n`)
			.join('') +
		`\t"events": [\n${body}\n\t]\n}\n`;
	// Any random uuid that reached a payload would make the file differ from run to run.
	const stray = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/g)?.filter(
		id => !id.startsWith('00000000-'),
	);
	if (stray?.length) throw new Error(`record-feed: ${spec.name} contains non-deterministic uuids: ${[...new Set(stray)].slice(0, 3).join(', ')}`);
	mkdirSync(OUT_DIR, { recursive: true });
	writeFileSync(resolve(OUT_DIR, `${spec.name}.json`), text);
	summarize(spec.name, events);
}

/**
 * Compresses every pre-fight countdown to `COUNTDOWN_REPLAY_MS`, then rewrites ids and
 * timestamps onto `BASE_EPOCH_MS` with strictly increasing epochs.
 *
 * A countdown is the 60 s that ends at a `ring.fight` event. Time `t` inside it maps to
 * `t - (t - start) * (1 - 3/60)`, and after it the whole 57 s is gone, so a `nextFightAt`
 * inside a later `ring.state` lands exactly where the compressed fight does.
 */
function remap(recorded: RecordedEvent[]): Array<{ id: string; atMs: number; data: GameEvent }> {
	const fightStarts = recorded
		.filter(e => e.data.type === 'ring.fight' && e.data.payload.eventName === 'fightBegins')
		.map(e => e.ts);
	const ratio = 1 - COUNTDOWN_REPLAY_MS / FIGHT_COUNTDOWN_MS;
	const compress = (t: number): number => {
		let removed = 0;
		for (const end of fightStarts) {
			const start = end - FIGHT_COUNTDOWN_MS;
			removed += Math.min(Math.max(t - start, 0), FIGHT_COUNTDOWN_MS) * ratio;
		}
		return t - removed;
	};
	const first = recorded[0]?.ts ?? 0;
	const origin = compress(first);
	let previous = -1;
	return recorded.map((event, index) => {
		const raw = Math.round(compress(event.ts) - origin);
		const atMs = Math.max(raw, previous + 1);
		previous = atMs;
		const epoch = BASE_EPOCH_MS + atMs;
		const data = event.data;
		data.id = `${epoch}-${index.toString(16).padStart(8, '0')}`;
		data.timestamp = epoch;
		// Times inside the payload (`nextFightAt`, and the raw engine state some events carry:
		// `hpUpdatedAt`, `hitLog[].when`, `respawnAt`) move onto the same compressed timeline.
		data.payload = remapEpochs(data.payload, value => BASE_EPOCH_MS + Math.round(compress(value) - origin)) as GameEvent['payload'];
		return { id: data.id, atMs, data };
	});
}

/** Rewrites every number that is a timestamp near the virtual clock's start (a window of a week). */
function remapEpochs(value: unknown, map: (epoch: number) => number): unknown {
	if (typeof value === 'number') {
		return value >= BASE_EPOCH_MS && value < BASE_EPOCH_MS + 7 * 86_400_000 ? map(value) : value;
	}
	if (Array.isArray(value)) return value.map(item => remapEpochs(item, map));
	if (value && typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const [key, item] of Object.entries(value)) out[key] = remapEpochs(item, map);
		return out;
	}
	return value;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function hasCardFrame(data: GameEvent): boolean {
	const lines = (data.payload as { lines?: Array<{ kind?: string }> }).lines;
	return Array.isArray(lines) && lines.some(line => line.kind === 'card');
}

function summarize(name: string, events: Array<{ atMs: number; data: GameEvent }>): void {
	const byType: Record<string, number> = {};
	let cardFrames = 0;
	const missingLines: Record<string, number> = {};
	for (const { data } of events) {
		byType[data.type] = (byType[data.type] ?? 0) + 1;
		if (hasCardFrame(data)) cardFrames += 1;
		const lines = (data.payload as { lines?: unknown }).lines;
		if (data.text && data.text.trim() && !Array.isArray(lines)) {
			missingLines[data.type] = (missingLines[data.type] ?? 0) + 1;
		}
	}
	const seconds = events.length ? (events[events.length - 1]!.atMs / 1000).toFixed(1) : '0';
	console.log(
		JSON.stringify({ name, events: events.length, seconds, cardFrameEvents: cardFrames, byType, textWithoutLines: missingLines }),
	);
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	const requested = process.argv.slice(2);
	const unknown = requested.filter(n => !FIXTURES.some(f => f.name === n));
	if (unknown.length) throw new Error(`record-feed: unknown fixture ${unknown.join(', ')}`);

	// Worker mode: `RECORD_FEED_WORKER=<name>` records one fixture in this process.
	const worker = process.env.RECORD_FEED_WORKER;
	if (worker) {
		const spec = FIXTURES.find(f => f.name === worker);
		if (!spec) throw new Error(`record-feed: unknown fixture ${worker}`);
		await record(spec);
		return;
	}

	const names = requested.length ? requested : FIXTURES.map(f => f.name);
	const self = fileURLToPath(import.meta.url);
	await Promise.all(
		names.map(
			name =>
				new Promise<void>((done, fail) => {
					const child = spawn(process.execPath, [self], {
						env: { ...process.env, RECORD_FEED_WORKER: name },
						stdio: ['ignore', 'inherit', 'inherit'],
					});
					child.on('exit', code =>
						code === 0 ? done() : fail(new Error(`record-feed: ${name} exited with ${code}`)),
					);
					child.on('error', fail);
				}),
		),
	);
}

main().then(
	() => process.exit(0),
	err => {
		console.error(err);
		process.exit(1);
	},
);
