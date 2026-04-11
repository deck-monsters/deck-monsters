/**
 * Prometheus metrics registry for Deck Monsters.
 *
 * All metrics carry a `room_id` label where applicable so dashboards can
 * optionally filter or aggregate per room.
 *
 * Expose via GET /metrics (see server/src/index.ts).
 * Compatible with Grafana Cloud free-tier Prometheus scraping.
 */
import { Registry, Counter, Gauge, Histogram } from 'prom-client';

export const registry = new Registry();
registry.setDefaultLabels({ service: 'deck-monsters' });

// ── Battle histograms ──────────────────────────────────────────────────────

export const battleDurationMs = new Histogram({
	name: 'dm_battle_duration_ms',
	help: 'Duration of combat from encounter start to conclusion (ms)',
	labelNames: ['room_id'] as const,
	buckets: [5_000, 15_000, 30_000, 60_000, 120_000, 300_000],
	registers: [registry],
});

export const battleRounds = new Histogram({
	name: 'dm_battle_rounds',
	help: 'Number of rounds per battle',
	labelNames: ['room_id'] as const,
	buckets: [1, 3, 5, 10, 15, 20],
	registers: [registry],
});

export const battleParticipants = new Histogram({
	name: 'dm_battle_participants',
	help: 'Number of monsters participating in a battle',
	labelNames: ['room_id'] as const,
	buckets: [2, 3, 4, 6, 8, 12],
	registers: [registry],
});

export const battleAvgMonsterLevel = new Histogram({
	name: 'dm_battle_avg_monster_level',
	help: 'Average level of monsters in a battle',
	labelNames: ['room_id'] as const,
	buckets: [1, 5, 10, 20, 30, 50],
	registers: [registry],
});

export const battleMinMonsterLevel = new Histogram({
	name: 'dm_battle_min_monster_level',
	help: 'Minimum monster level in a battle',
	labelNames: ['room_id'] as const,
	buckets: [1, 5, 10, 20, 30, 50],
	registers: [registry],
});

export const battleMaxMonsterLevel = new Histogram({
	name: 'dm_battle_max_monster_level',
	help: 'Maximum monster level in a battle',
	labelNames: ['room_id'] as const,
	buckets: [1, 5, 10, 20, 30, 50],
	registers: [registry],
});

export const battleRoundDurationMs = new Histogram({
	name: 'dm_battle_round_duration_ms',
	help: 'Average duration per round within a battle (ms)',
	labelNames: ['room_id'] as const,
	buckets: [500, 1_000, 3_000, 10_000, 30_000],
	registers: [registry],
});

export const turnGapMs = new Histogram({
	name: 'dm_turn_gap_ms',
	help: 'Elapsed time between consecutive card.played events within an encounter (ms)',
	labelNames: ['room_id'] as const,
	buckets: [250, 500, 1_000, 1_500, 2_000, 3_000, 5_000, 8_000],
	registers: [registry],
});

// ── Battle event counters ──────────────────────────────────────────────────

export const battlesStarted = new Counter({
	name: 'dm_battles_started_total',
	help: 'Total battles started (countdown fired)',
	labelNames: ['room_id'] as const,
	registers: [registry],
});

export const battlesCompleted = new Counter({
	name: 'dm_battles_completed_total',
	help: 'Total battles completed',
	labelNames: ['room_id'] as const,
	registers: [registry],
});

export const playerWins = new Counter({
	name: 'dm_player_wins_total',
	help: 'Total monster wins',
	labelNames: ['room_id'] as const,
	registers: [registry],
});

export const playerLosses = new Counter({
	name: 'dm_player_losses_total',
	help: 'Total monster losses',
	labelNames: ['room_id'] as const,
	registers: [registry],
});

export const playerDraws = new Counter({
	name: 'dm_player_draws_total',
	help: 'Total battle draws',
	labelNames: ['room_id'] as const,
	registers: [registry],
});

export const playerFled = new Counter({
	name: 'dm_player_fled_total',
	help: 'Total monsters that fled',
	labelNames: ['room_id'] as const,
	registers: [registry],
});

export const monsterPermDeaths = new Counter({
	name: 'dm_monster_perm_deaths_total',
	help: 'Total permanent monster deaths',
	labelNames: ['room_id'] as const,
	registers: [registry],
});

export const bossSpawns = new Counter({
	name: 'dm_boss_spawns_total',
	help: 'Total boss monster spawns',
	labelNames: ['room_id'] as const,
	registers: [registry],
});

// ── Ring state ─────────────────────────────────────────────────────────────

export const monstersInRing = new Gauge({
	name: 'dm_monsters_in_ring',
	help: 'Current number of monsters waiting in or fighting in the ring',
	labelNames: ['room_id'] as const,
	registers: [registry],
});

// ── Room metrics ───────────────────────────────────────────────────────────

export const roomsCreated = new Counter({
	name: 'dm_rooms_created_total',
	help: 'Total rooms ever created',
	registers: [registry],
});

export const roomsActive = new Gauge({
	name: 'dm_rooms_active',
	help: 'Number of currently loaded/active rooms',
	registers: [registry],
});

// ── Command & error metrics ────────────────────────────────────────────────

export const commandsTotal = new Counter({
	name: 'dm_commands_total',
	help: 'Total game commands processed',
	labelNames: ['room_id', 'result'] as const,
	registers: [registry],
});

export const cardErrors = new Counter({
	name: 'dm_card_errors_total',
	help: 'Card play errors during combat (invalid card mid-fight)',
	labelNames: ['room_id'] as const,
	registers: [registry],
});

export const cardValidationWarnings = new Counter({
	name: 'dm_card_validation_warnings_total',
	help: 'Card validation warnings detected at ring-join time',
	labelNames: ['room_id'] as const,
	registers: [registry],
});

export const fightErrors = new Counter({
	name: 'dm_fight_errors_total',
	help: 'Unexpected errors that cancelled a fight and cleared the ring',
	labelNames: ['room_id'] as const,
	registers: [registry],
});

export const roomHydrationFailures = new Counter({
	name: 'dm_room_hydration_failures_total',
	help: 'State blob hydration failures (blob quarantined, fresh game started)',
	labelNames: ['room_id'] as const,
	registers: [registry],
});

export const roomHydrationWarnings = new Counter({
	name: 'dm_room_hydration_warnings_total',
	help: 'Non-fatal partial hydration warnings during room load',
	labelNames: ['room_id'] as const,
	registers: [registry],
});

export const promptTimeouts = new Counter({
	name: 'dm_prompt_timeouts_total',
	help: 'Interactive prompts that timed out without a player response',
	labelNames: ['room_id'] as const,
	registers: [registry],
});

// ── WebSocket metrics ──────────────────────────────────────────────────────

export const wsConnectionsActive = new Gauge({
	name: 'dm_ws_connections_active',
	help: 'Number of active WebSocket ringFeed subscribers',
	labelNames: ['room_id'] as const,
	registers: [registry],
});
