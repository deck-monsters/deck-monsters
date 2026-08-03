import zlib from 'node:zlib';

import { find, reduce } from './helpers/collection.js';
import { all as cardTypes, draw } from './cards/index.js';
import { all as itemTypes } from './items/index.js';
import { allMonsters as monsterTypes } from './monsters/index.js';
import { COINS_PER_VICTORY, COINS_PER_DEFEAT } from './constants/coins.js';
import { createCharacter } from './characters/index.js';
import { globalSemaphore } from './helpers/semaphore.js';
import { listen, loadHandlers } from './commands/index.js';
import { sortByXP } from './helpers/sort.js';
import { XP_PER_VICTORY, XP_PER_DEFEAT } from './helpers/experience.js';
import { initialize as initializeAnnouncements, createRoomScopedEventGuard } from './announcements/index.js';
import { BaseClass } from './shared/baseClass.js';
import cardOdds from './card-odds.json' with { type: 'json' };
import { dungeonMasterGuide } from './build/dungeon-master-guide.js';
import { Exploration } from './exploration/index.js';
import { monsterManual } from './build/monster-manual.js';
import { playerHandbook } from './build/player-handbook.js';
import { Ring } from './ring/index.js';
import { RoomEventBus } from './events/index.js';
import type { StateStore } from './types/state-store.js';
import { resolveShop, type Shop } from './items/store/shop.js';
import type { BossSummonLedger } from './helpers/boss-summons.js';
import { refundPendingSummons } from './helpers/boss-summons.js';
import { announceAndThrow } from './helpers/announce-and-throw.js';

// State save debounce: 30 seconds
const SAVE_DEBOUNCE_MS = 30_000;

export type LeaderboardSortKey = 'xp' | 'wins' | 'winRate' | 'coins';

/** Optional server-injected analytics (web connector). */
export interface GameAnalyticsCallbacks {
	fetchRoomPlayerLeaderboard?: (
		sortBy: LeaderboardSortKey,
		limit: number
	) => Promise<string | null>;
	fetchRoomMonsterLeaderboard?: (
		sortBy: LeaderboardSortKey,
		limit: number
	) => Promise<string | null>;
	fetchGlobalPlayerLeaderboard?: (
		sortBy: LeaderboardSortKey,
		limit: number
	) => Promise<string | null>;
	fetchGlobalMonsterLeaderboard?: (
		sortBy: LeaderboardSortKey,
		limit: number
	) => Promise<string | null>;
	catchUp?: (userId: string, since: Date | null) => Promise<string | null>;
}

export class Game extends BaseClass {
	static eventPrefix = 'game';

	log: (err: unknown) => void;
	ring: Ring;
	exploration: Exploration;
	roomId: string;
	stateSaveFunc?: (state: string) => void;
	stateStore?: StateStore;
	/** Injected by the API server for DB-backed leaderboards / catch-up. */
	analytics?: GameAnalyticsCallbacks;
	private _eventBus: RoomEventBus;
	private _saveDebounce?: ReturnType<typeof setTimeout>;
	private _disposeListeners: Array<() => void> = [];

	constructor(
		options: Record<string, unknown> = {},
		log: (err: unknown) => void = () => {}
	) {
		super(options, globalSemaphore);

		this.log = log;

		this.roomId = (options as any).roomId ?? 'default';
		this._eventBus = new RoomEventBus(this.roomId);

		this.ring = new Ring(
			this._eventBus,
			{
				spawnBosses: (this.options as any).spawnBosses,
				ringEvents: (this.options as any).ringEvents,
				getRoomMonsterLevels: () => this.getRoomMonsterLevels(),
			},
			this.log
		);
		this.exploration = new Exploration(this._eventBus as any, {}, this.log);

		// Refund pending boss summons from before the last restart. Any summon recorded
		// in the 30–60 s window between `summon a boss` and the fight starting had its
		// charge spent but the ephemeral boss vanished with the process. We give the charge
		// back before any player-facing code can see the ledger.
		// See docs/boss-encounters.md §3 (Finding 6 — restart-gap fix).
		this._refundPendingBossSummons();

		this.initializeEvents();
		loadHandlers();

		// Re-populate ring contestants that were in the ring before the last server restart.
		// The ring itself is not serialized (it's a runtime property), so we store minimal
		// {userId, stableId} refs in game options and re-hydrate them here.
		const ringContestantRefs = (options as any).ringContestantRefs as
			Array<{ userId: string; stableId: string }> | undefined;
		if (ringContestantRefs?.length) {
			const characters = (this.options as any).characters as Record<string, any> | undefined;
			const restored: import('./ring/index.js').Contestant[] = [];
			for (const { userId, stableId } of ringContestantRefs) {
				const character = characters?.[userId];
				const monster = (character?.monsters as any[] | undefined)
					?.find((m: any) => m.stableId === stableId);
				if (character && monster) {
					restored.push({ monster, character, userId });
				}
			}
			if (restored.length > 0) {
				this.ring.contestants = restored;
				this.ring.startFightTimer();
			}
		}

		this.emit('initialized');
	}

	get eventBus(): RoomEventBus {
		return this._eventBus;
	}

	private scheduleSave(): void {
		if (this._saveDebounce !== undefined) {
			clearTimeout(this._saveDebounce);
			this._saveDebounce = undefined;
		}
		if (!this.stateSaveFunc && !this.stateStore) return;
		this._saveDebounce = setTimeout(() => {
			this._saveDebounce = undefined;
			this.persistState();
		}, SAVE_DEBOUNCE_MS);
	}

	private persistState(): void {
		// Snapshot non-boss contestant refs so the ring can be restored after a server restart.
		const ringContestantRefs = this.ring.contestants
			.filter(c => !c.isBoss)
			.map(c => ({ userId: c.userId, stableId: c.monster.stableId }));
		// Avoid setOptions() here: it emits stateChange which would re-schedule another
		// debounced save and create an unintended save loop.
		if (ringContestantRefs.length > 0) {
			this.optionsStore = {
				...this.optionsStore,
				ringContestantRefs,
			};
		} else {
			const { ringContestantRefs: _omit, ...rest } = this.optionsStore as any;
			this.optionsStore = rest;
		}

		const buffer = zlib.gzipSync(JSON.stringify(this));
		const string = buffer.toString('base64');

		if (this.stateStore) {
			this.stateStore.save(this.roomId, string).catch((err: unknown) => this.log(err));
		}

		if (this.stateSaveFunc) {
			setImmediate(this.stateSaveFunc, string);
		}
	}

	reset(options: Record<string, unknown>): void {
		this.optionsStore = {};
		this.setOptions(options as any);
	}

	get characters(): Record<string, any> {
		if ((this.options as any).characters === undefined) {
			this.characters = {};
		}

		return (this.options as any).characters || {};
	}

	set characters(characters: Record<string, any>) {
		this.setOptions({ characters } as any);
	}

	/** Room-scoped shop — see docs/room-scoping.md. Regenerates itself past its closing time. */
	get shop(): Shop {
		const stored = (this.options as any).shop as Shop | undefined;
		const resolved = resolveShop(stored, Date.now());

		if (resolved !== stored) {
			this.commitShop(resolved);
		}

		return resolved;
	}

	commitShop(shop: Shop): void {
		this.setOptions({ shop } as any);
	}

	/**
	 * Room-scoped boss summon ledger — see `helpers/boss-summons.ts`.
	 *
	 * Deliberately a pure read, unlike `shop` above: pruning here would call `setOptions()`,
	 * which broadcasts `stateChange` synchronously. Expired entries are pruned by
	 * `recordSummon()` instead. See `docs/engine-concurrency-and-timing.md` §7.
	 */
	get bossSummons(): BossSummonLedger {
		return ((this.options as any).bossSummons as BossSummonLedger | undefined) ?? {};
	}

	set bossSummons(bossSummons: BossSummonLedger) {
		this.setOptions({ bossSummons } as any);
	}

	/**
	 * Pending boss summons: timestamps recorded in `bossSummons` but whose encounter
	 * has not yet started. If the process restarts before the encounter begins, the boss
	 * vanishes (bosses are ephemeral) but the charge was already spent — this ledger
	 * lets the constructor refund those charges on restore. Cleared when a fight starts.
	 * See docs/boss-encounters.md §3 (Finding 6 — restart-gap fix).
	 */
	get bossSummonsPending(): BossSummonLedger {
		return ((this.options as any).bossSummonsPending as BossSummonLedger | undefined) ?? {};
	}

	set bossSummonsPending(bossSummonsPending: BossSummonLedger) {
		this.setOptions({ bossSummonsPending } as any);
	}

	/**
	 * Removes pending boss summon timestamps from the main ledger and clears the pending
	 * ledger. Called once at construction time (before `initializeEvents`) so any restart
	 * that caught a summon mid-flight gives the charge back.
	 *
	 * Writes via `optionsStore` directly to avoid emitting `stateChange` during
	 * construction — listeners are not yet attached at this point.
	 */
	private _refundPendingBossSummons(): void {
		const pending = (this.options as any).bossSummonsPending as BossSummonLedger | undefined;
		if (!pending || Object.keys(pending).length === 0) return;

		const main = (this.options as any).bossSummons as BossSummonLedger | undefined ?? {};
		const { ledger: refunded, pending: cleared } = refundPendingSummons(main, pending);

		// Mutate optionsStore directly: setOptions() would emit stateChange which is
		// not desirable during construction before listeners are wired up.
		this.optionsStore = {
			...this.optionsStore,
			bossSummons: refunded,
			bossSummonsPending: cleared,
		};
	}

	private getRoomMonsterLevels(): number[] {
		return Object.values(this.characters)
			.flatMap((character: any) =>
				Array.isArray(character?.monsters) ? character.monsters : []
			)
			.filter((monster: any) => monster && !monster.dead && !monster.destroyed)
			.map((monster: any) => Number(monster?.level ?? 0))
			.filter((level: number) => Number.isFinite(level) && level >= 0);
	}

	get saveState(): () => void {
		return () => this.persistState();
	}

	set saveState(stateSaveFunc: ((state: string) => void) | undefined) {
		if (stateSaveFunc) {
			this.stateSaveFunc = stateSaveFunc;
		} else {
			delete this.stateSaveFunc;
		}
	}

	initializeEvents(): void {
		const disposeAnnouncements = initializeAnnouncements(this);

		// `creature.win` / `creature.loss` / `creature.permaDeath` / `creature.fled`
		// and `stateChange` are all broadcast on the process-wide globalSemaphore
		// (see BaseClass.emit / setOptions) — not scoped to any one room. Without
		// this guard, one room's fight outcome would double-award XP/coins/card
		// drops on every OTHER loaded Game instance's identical listener (this was
		// a real, previously-unguarded bug: reward-granting handlers here were the
		// only creature.* listeners in the engine that skipped the room-scoping
		// applied everywhere else in announcements/index.ts), and any unrelated
		// room's state change would reset every other room's save debounce timer.
		const isRoomScopedEvent = createRoomScopedEventGuard(this);
		const wrapGameEvent =
			<F extends (...args: any[]) => void>(fn: F): F =>
				((...args: any[]) => {
					if (!isRoomScopedEvent(...args)) return;
					fn(...args);
				}) as F;

		const boundWin = this.on('creature.win', wrapGameEvent(this.handleWinner.bind(this)));
		const boundLoss = this.on('creature.loss', wrapGameEvent(this.handleLoser.bind(this)));
		const boundPermaDeath = this.on(
			'creature.permaDeath',
			wrapGameEvent(this.handlePermaDeath.bind(this))
		);
		const boundFled = this.on('creature.fled', wrapGameEvent(this.handleFled.bind(this)));
		const boundStateChange = this.on(
			'stateChange',
			wrapGameEvent(() => this.scheduleSave())
		);

		// Finalize pending boss summons when a fight actually starts. This completes the
		// restart-gap fix: once the encounter begins, the boss is firmly in play and the
		// charge is genuinely spent — pending can be cleared so a subsequent restart won't
		// mistakenly refund it. See docs/boss-encounters.md §3.
		const unsubBossFinalizer = this._eventBus.subscribe('game-boss-summon-finalizer', {
			deliver: (event) => {
				if (event.type === 'ring.fight' && (event.payload as any)?.eventName === 'fightBegins') {
					if (Object.keys(this.bossSummonsPending).length > 0) {
						this.bossSummonsPending = {};
					}
				}
			},
		});

		this._disposeListeners = [
			disposeAnnouncements,
			() => this.off('creature.win', boundWin),
			() => this.off('creature.loss', boundLoss),
			() => this.off('creature.permaDeath', boundPermaDeath),
			() => this.off('creature.fled', boundFled),
			() => this.off('stateChange', boundStateChange),
			unsubBossFinalizer,
		];
	}

	dispose(): void {
		// Cancel pending saves
		if (this._saveDebounce !== undefined) {
			clearTimeout(this._saveDebounce);
			this._saveDebounce = undefined;
		}
		// Remove all globalSemaphore listeners registered for this game instance
		this._disposeListeners.forEach(fn => fn());
		this._disposeListeners = [];
		// Stop ring timers so orphaned Game instances don't keep firing
		this.ring.dispose();
		this.exploration.dispose();

		// Creatures use setInterval/setTimeout for passive healing and respawn — clear
		// them so scripts (harness, tests) can exit without waiting minutes.
		for (const character of Object.values(this.characters)) {
			if (character && typeof character.disposeTimers === 'function') {
				character.disposeTimers();
			}
			const monsters = character?.monsters as Array<{ disposeTimers?: () => void }> | undefined;
			if (monsters) {
				for (const monster of monsters) {
					monster.disposeTimers?.();
				}
			}
		}
	}

	handleCommand({ command, game = this }: { command: string; game?: Game }): any {
		return listen({ command, game });
	}

	handleWinner(className: string, monster: any, { contestant }: { contestant: any }): void {
		contestant.character.xp += XP_PER_VICTORY;
		contestant.character.coins += COINS_PER_VICTORY;

		const card = this.drawCard({}, monster);
		contestant.character.addCard(card);

		this.emit('cardDrop', { contestant, card });

		this.emit('gainedXP', {
			contestant,
			creature: contestant.character,
			xpGained: XP_PER_VICTORY,
			coinsGained: COINS_PER_VICTORY,
		});
	}

	handlePermaDeath(className: string, monster: any, { contestant }: { contestant: any }): void {
		contestant.character.xp += XP_PER_DEFEAT * 2;
		contestant.character.coins += COINS_PER_DEFEAT * 2;

		this.emit('gainedXP', {
			contestant,
			creature: contestant.character,
			xpGained: XP_PER_DEFEAT * 2,
			coinsGained: COINS_PER_DEFEAT * 2,
		});
	}

	handleLoser(className: string, monster: any, { contestant }: { contestant: any }): void {
		contestant.character.xp += XP_PER_DEFEAT;
		contestant.character.coins += COINS_PER_DEFEAT;

		this.emit('gainedXP', {
			contestant,
			creature: contestant.character,
			xpGained: XP_PER_DEFEAT,
			coinsGained: COINS_PER_DEFEAT,
		});
	}

	handleFled(className: string, monster: any, { contestant }: { contestant: any }): void {
		monster.xp += XP_PER_DEFEAT;
		contestant.character.xp += XP_PER_DEFEAT;
		contestant.character.coins += COINS_PER_DEFEAT;

		this.emit('gainedXP', {
			contestant,
			creature: contestant.character,
			xpGained: XP_PER_DEFEAT,
			coinsGained: COINS_PER_DEFEAT,
		});

		this.emit('gainedXP', {
			contestant,
			creature: monster,
			xpGained: XP_PER_DEFEAT,
		});
	}

	clearRing(): void {
		this.ring.clearRing();
	}

	getCharacter({
		channel,
		gender,
		icon,
		id,
		name,
		type,
	}: {
		channel: any;
		gender?: string;
		icon?: string;
		id: string;
		name: string;
		type?: string;
	}): Promise<any> {
		const game = this;

		return Promise.resolve(this.characters[id]).then(existingCharacter => {
			if (!existingCharacter) {
				return createCharacter(channel, {
					name,
					type,
					gender,
					icon,
					game,
				}).then((character: any) => {
					game.characters[id] = character;

					// Direct mutation of the options-backed characters map: bypasses
					// setOptions(), so no `stateChange` fires from this assignment alone.
					// The new character's own constructor already triggers a `stateChange`
					// globally, but at that point it isn't in `game.characters` yet, so
					// the room-scoped guard added above would not attribute it to this
					// game — without this explicit emit, a freshly created character
					// could be silently lost if the server restarts before any other
					// state in this room changes.
					game.emit('stateChange');
					game.emit('characterCreated', { character });

					return character;
				});
			}

			// If the character was created with the generic 'Player' fallback name
			// (before server-side display name resolution), update it silently.
			if (
				existingCharacter.givenName === 'Player' &&
				name &&
				name !== 'Player'
			) {
				existingCharacter.setOptions({ name });
				game.emit('stateChange', { character: existingCharacter });
			}

			return existingCharacter;
		});
	}

	static getCardTypes(): Record<string, any> {
		return (cardTypes as any[]).reduce((obj: Record<string, any>, Card: any) => {
			obj[Card.cardType.toLowerCase()] = Card;
			return obj;
		}, {});
	}

	static getItemTypes(): Record<string, any> {
		return (itemTypes as any[]).reduce((obj: Record<string, any>, Item: any) => {
			obj[Item.itemType.toLowerCase()] = Item;
			return obj;
		}, {});
	}

	static getMonsterTypes(): Record<string, any> {
		return (monsterTypes as any[]).reduce((obj: Record<string, any>, Monster: any) => {
			obj[Monster.monsterType.toLowerCase()] = Monster;
			return obj;
		}, {});
	}

	getAllMonstersLookup(): Record<string, any> {
		return reduce(
			this.characters,
			(all: Record<string, any>, character: any) => {
				character.monsters.forEach((monster: any) => {
					all[monster.givenName.toLowerCase()] = monster;
				});

				return all;
			},
			{}
		);
	}

	findCharacterByName(name: string): any {
		return find(
			this.characters,
			(character: any) => character.givenName.toLowerCase() === name.toLowerCase()
		);
	}

	lookAtCharacter(channel: any, characterName: string, self: any): Promise<unknown> {
		if (!characterName) {
			if (self) return self.look(channel, true);
		} else {
			const character = this.findCharacterByName(characterName);
			const isSelf = character === self;

			if (character) return character.look(channel, isSelf);
		}

		return announceAndThrow(channel, `I can find no character by the name of ${characterName}.`, { delay: 'short' });
	}

	getCreatureRankings(creatures: any[], top = 5): string[] {
		const sortedCreatures = sortByXP(creatures).reverse();
		sortedCreatures.length = Math.min(sortedCreatures.length, top);

		const maxLength = sortedCreatures.reduce(
			(length: number, creature: any) => Math.max(creature.givenName.length, length),
			0
		);
		const padding = ' '.repeat(maxLength);

		return sortedCreatures.map((creature: any) => {
			const paddedName = `${creature.givenName}${padding}`.slice(0, maxLength);

			return `${paddedName}   ${creature.xp}`;
		});
	}

	async lookAtCharacterRankings(channel: any): Promise<unknown> {
		const text = await this.analytics?.fetchRoomPlayerLeaderboard?.('xp', 5);
		if (text) {
			return channel({ announce: text, delay: 'short' });
		}

		const results = this.getCreatureRankings(Object.values(this.characters));

		return channel({
			announce: `*Top ${results.length} Players by XP:*\n\n\`\`\`\n${results.join('\n')}\n\`\`\`\n`,
			delay: 'short',
		});
	}

	async lookAtMonsterRankings(channel: any): Promise<unknown> {
		const text = await this.analytics?.fetchRoomMonsterLeaderboard?.('xp', 5);
		if (text) {
			return channel({ announce: text, delay: 'short' });
		}

		const results = this.getCreatureRankings(Object.values(this.getAllMonstersLookup()));

		return channel({
			announce: `*Top ${results.length} Monsters by XP:*\n\n\`\`\`\n${results.join('\n')}\n\`\`\`\n`,
			delay: 'short',
		});
	}

	async lookAtGlobalCharacterRankings(channel: any): Promise<unknown> {
		const text = await this.analytics?.fetchGlobalPlayerLeaderboard?.('xp', 5);
		if (text) {
			return channel({ announce: text, delay: 'short' });
		}

		return channel({
			announce: 'Global rankings are not available in this environment.',
			delay: 'short',
		});
	}

	async lookAtGlobalMonsterRankings(channel: any): Promise<unknown> {
		const text = await this.analytics?.fetchGlobalMonsterLeaderboard?.('xp', 5);
		if (text) {
			return channel({ announce: text, delay: 'short' });
		}

		return channel({
			announce: 'Global rankings are not available in this environment.',
			delay: 'short',
		});
	}

	async catchUpCommand(channel: any, userId: string): Promise<unknown> {
		const text = await this.analytics?.catchUp?.(userId, null);
		if (text) {
			return channel({ announce: text, delay: 'short' });
		}

		return channel({
			announce: 'Catch-up summaries require the web server.',
			delay: 'short',
		});
	}

	editSelfCharacter(channel: any, character: any): Promise<unknown> {
		if (character) return character.editSelf(channel);
		return announceAndThrow(channel, 'Could not find your character.', { delay: 'short' });
	}

	editCharacter(channel: any, characterName: string): Promise<unknown> {
		if (characterName) {
			const character = this.findCharacterByName(characterName);

			if (character) return character.edit(channel);
		}

		return announceAndThrow(channel, `I can find no character by the name of ${characterName}.`, { delay: 'short' });
	}

	lookAtMonster(channel: any, monsterName: string, character: any): Promise<unknown> {
		if (monsterName) {
			const allMonsters = this.getAllMonstersLookup();
			const monster = allMonsters[monsterName.toLowerCase()];
			const ownsMonster = character.ownsMonster(monsterName);

			if (monster) return monster.look(channel, ownsMonster);
		}

		return announceAndThrow(channel, `I can find no monster by the name of ${monsterName}.`, { delay: 'short' });
	}

	editMonster(channel: any, monsterName: string): Promise<unknown> {
		if (monsterName) {
			const allMonsters = this.getAllMonstersLookup();
			const monster = allMonsters[monsterName.toLowerCase()];

			if (monster) return monster.edit(channel);
		}

		return announceAndThrow(channel, `I can find no monster by the name of ${monsterName}.`, { delay: 'short' });
	}

	lookAtCard(channel: any, cardName: string): Promise<unknown> {
		if (cardName) {
			const cards = (this.constructor as typeof Game).getCardTypes();
			const Card = cards[cardName.toLowerCase()];

			if (Card) {
				const card = new Card();
				return card.look(channel, true);
			}
		}

		return announceAndThrow(channel, `Sorry, we don't carry ${cardName} cards here.`, { delay: 'short' });
	}

	lookAtItem(channel: any, itemName: string): Promise<unknown> {
		if (itemName) {
			const items = (this.constructor as typeof Game).getItemTypes();
			const Item = items[itemName.toLowerCase()];

			if (Item) {
				const item = new Item();
				return item.look(channel, true);
			}
		}

		return announceAndThrow(channel, `Sorry, we don't carry ${itemName} here.`, { delay: 'short' });
	}

	getCardProbabilities(): unknown {
		return cardOdds;
	}

	getRing(): Ring {
		return this.ring;
	}

	getExploration(): Exploration {
		return this.exploration;
	}

	lookAtRing(userId: string, _ringName = 'main', showCharacters?: boolean, summary?: boolean): Promise<void> {
		return this.getRing().look(userId, showCharacters, summary);
	}

	lookAtRingCards(userId: string, _ringName = 'main'): Promise<void> {
		return this.getRing().lookAtCards(userId);
	}

	lookAt(channel: any, thing: string): Promise<unknown> {
		if (thing) {
			if (thing.match(/(?:dungeon master(?:s)?|dm) guide|dmg/i)) {
				return dungeonMasterGuide({ channel });
			}

			if (thing.match(/monster(?:s)? manual/i)) {
				return monsterManual({ channel });
			}

			if (thing.match(/player(?:s)? handbook/i)) {
				return playerHandbook(channel);
			}

			const monsters = this.getAllMonstersLookup();
			const monster = monsters[thing];

			if (monster) return monster.look(channel);

			const cards = (this.constructor as typeof Game).getCardTypes();
			const Card = cards[thing];

			if (Card) {
				const card = new Card();
				return card.look(channel);
			}

			const items = (this.constructor as typeof Game).getItemTypes();
			const Item = items[thing];

			if (Item) {
				const item = new Item();
				return item.look(channel);
			}
		}

		return announceAndThrow(channel, `I don't see a ${thing} here.`, { delay: 'short' });
	}

	drawCard(options: Record<string, unknown>, monster?: any): any {
		const card = draw(options, monster);

		this.emit('cardDrawn', { card });

		return card;
	}
}

export default Game;
