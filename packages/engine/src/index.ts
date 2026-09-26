import zlib from 'node:zlib';

import { hydrateCharacter } from './characters/index.js';
import { hydrateShop } from './items/store/hydrate.js';
import { gameStateSchema } from './schemas/state.js';
import Game from './game.js';
import type { ChannelCallback } from './channel/index.js';
import { ConnectorAdapter } from './channel/index.js';
import { RoomEventBus, PROMPT_CANCELLED, PromptCancelledError, toCombatActor } from './events/index.js';
import type {
	CombatActor,
	CombatPayload,
	GameEvent,
	EventType,
	EventScope,
	EventSubscriber,
	EventsSinceResult,
} from './events/index.js';

export { Game, ConnectorAdapter, RoomEventBus, PROMPT_CANCELLED, PromptCancelledError, toCombatActor };
export { CommandRefusalError, isCommandRefusal } from './helpers/command-refusal-error.js';
export { announceAndThrow } from './helpers/announce-and-throw.js';
export type { GameAnalyticsCallbacks, LeaderboardSortKey } from './game.js';
export type {
	ChannelCallback,
	CombatActor,
	CombatPayload,
	GameEvent,
	EventType,
	EventScope,
	EventSubscriber,
	EventsSinceResult,
};
export type { StateStore } from './types/state-store.js';
export { engineReady, getHydratorStatus } from './helpers/engine-ready.js';
export { getCardClassByTypeName } from './cards/index.js';
/** One weighted card draw, filtered by a creature-shaped `{ level, canHoldCard }` (used by @deck-monsters/harness). */
export { draw as drawCard } from './cards/index.js';
export { COMMAND_CATALOG } from './commands/catalog.js';
export type { CommandEntry, CommandCategory } from './commands/catalog.js';
export { purchaseShopItem } from './items/store/purchase.js';
export type { ShopItemSection, ShopPurchaseResult } from './items/store/purchase.js';
export { sellToShop } from './items/store/sell-to-shop.js';
export type { SellSection, SellSelection, ShopSaleLine, ShopSaleResult } from './items/store/sell-to-shop.js';
export { getSalePrice, getSaleTotal } from './items/store/sell-pricing.js';

/** Test harness and integration helpers (no Slack/HTTP/DB). */
export * from './testing/index.js';

/** Seeded ring contestants for simulations (used by @deck-monsters/harness). */
export { randomContestant } from './helpers/bosses.js';
export type { RandomContestantOptions } from './helpers/bosses.js';
/**
 * Coin-payout constants and the once-daily-bonus day key, so a caller measuring steady-state
 * payouts (used by @deck-monsters/harness's `simulate()`) can pin a character's
 * `lastDailyFightCoinDay`/`battles.total` past the once-daily and early-battle bonuses in
 * `game.ts`'s `awardFightCoins` instead of asserting against the raw numbers.
 */
export { COINS_PER_VICTORY, COINS_PER_DEFEAT, getUtcDay } from './constants/coins.js';
export { EARLY_COIN_BONUS_TIERS } from './constants/progression.js';
export { createKeyedPromiseQueue } from './helpers/room-engine-queue.js';
/** How the engine renders a stored creature name as `givenName` — needed to compare against one. */
export { startCase } from './helpers/start-case.js';
export { getLevel } from './helpers/levels.js';
export type { Contestant, RingContestantSnapshot } from './ring/index.js';
export { getXpCapForLevel } from './ring/index.js';
export {
	BOSS_SUMMON_LIMIT,
	BOSS_SUMMON_WINDOW_MS,
	recordSummon,
	summonAllowance,
} from './helpers/boss-summons.js';
export type { BossSummonLedger, SummonAllowance } from './helpers/boss-summons.js';
export { RING_EVENTS, getRingEvent, selectRingEvent } from './ring/ring-events.js';
export type { RingEventDefinition, RingEventId, VictoryMode } from './ring/ring-events.js';
export { allMonsters } from './monsters/index.js';
/** Every item class the engine knows about, for lookup by `itemType` — mirrors `allMonsters`. */
export { default as allItems } from './items/helpers/all.js';
/**
 * Character-creation choices a non-interactive caller has to collect up front, since a
 * prompt-free channel cannot ask for them
 * (docs/architecture/engine-concurrency-and-timing.md).
 */
export { randomAvatarChoices } from './characters/helpers/create.js';
export { PRONOUNS, PRONOUN_KEYS, PRONOUN_CHOICES } from './helpers/pronouns.js';
export type { Gender } from './helpers/pronouns.js';

export const getOptions = (gameJSON: string | Record<string, unknown>): Record<string, unknown> => {
	let gameObj: Record<string, unknown>;

	if (typeof gameJSON === 'string') {
		try {
			gameObj = JSON.parse(gameJSON) as Record<string, unknown>;
		} catch {
			gameObj = JSON.parse(
				zlib.gunzipSync(Buffer.from(gameJSON, 'base64')).toString()
			) as Record<string, unknown>;
		}
	} else {
		gameObj = Object.assign({}, gameJSON);
	}

	const parsedState = gameStateSchema.safeParse(gameObj);

	if (!parsedState.success) {
		throw new Error('Invalid game state payload');
	}

	gameObj = parsedState.data as Record<string, unknown>;

	const options: Record<string, unknown> = Object.assign(
		{ characters: {} },
		(gameObj as any).options
	);

	const rawCharacters = options.characters as Record<string, unknown>;
	options.characters = Object.entries(rawCharacters).reduce(
		(characters: Record<string, unknown>, [id, character]) => {
			try {
				characters[id] = hydrateCharacter(character as any);
			} catch (err) {
				// Skip one bad character rather than losing the entire game state.
				// The bad data is already quarantined at the RoomManager layer.
			}

			return characters;
		},
		{}
	);

	if (options.shop) {
		try {
			options.shop = hydrateShop(options.shop as Record<string, unknown>);
		} catch (err) {
			// A corrupt shop shouldn't take down the rest of the room's state —
			// drop it and let Game.shop regenerate a fresh one on next access.
			delete options.shop;
		}
	}

	return options;
};

export const restoreGame = (
	gameJSON: string | Record<string, unknown>,
	log?: (err: unknown) => void
): Game => {
	const options = getOptions(gameJSON);

	return new Game(options, log);
};

export const resetGame = (
	game: Game,
	gameJSON: string | Record<string, unknown>
): void => {
	const options = getOptions(gameJSON);

	if (options) {
		game.reset(options);
	}
};
