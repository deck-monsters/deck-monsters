import { BaseClass } from '../shared/baseClass.js';
import { random, shuffle } from '../helpers/random.js';
import { actionCard, monsterCard } from '../helpers/card.js';
import { calculateXP } from '../helpers/experience.js';
import { getTarget } from '../helpers/targeting-strategies.js';
import { randomContestant } from '../helpers/bosses.js';
import {
	buildRingEventContext,
	getRingEvent,
	selectRingEvent,
	type RingEventDefinition,
} from './ring-events.js';
import { getLevel } from '../helpers/levels.js';
import { sortCardsAlphabetically } from '../cards/helpers/sort.js';
import { delaysAreSkipped, groupedBeatMs, remainingGapMs, shortDelay, subEventDelay, subEventDelayMs, veryShortDelay } from '../helpers/delay-times.js';
import { uniqueCards } from '../cards/helpers/unique-cards.js';
import type { RoomEventBus } from '../events/index.js';

/**
 * A single reading beat, sized by the message just published. Used between the turn
 * banner and the card box, which otherwise arrive in the same tick. Resolves without a
 * timer in skip mode, matching the other continuation paths in `doAction`.
 */
const turnBeat = (speedMultiplier = 1): Promise<void> =>
	delaysAreSkipped()
		? Promise.resolve()
		: new Promise<void>(resolve => setTimeout(resolve, Math.round(subEventDelayMs() / speedMultiplier)));

const MAX_BOSSES = 5;
const MAX_MONSTERS = 12;
const MIN_MONSTERS = 2;
const FIGHT_DELAY = 60000;
const BOSS_WARNING_DELAY_MS = 120000;
const BOSS_DESPAWN_DELAY_MS = 600000;
const BOSS_SPAWN_MIN_DELAY_MS = 1_200_000; // 20 min
const BOSS_SPAWN_MAX_DELAY_MS = 2_100_000; // 35 min
const BOSS_SPAWN_BEGINNER_MIN_DELAY_MS = 720_000; // 12 min
const BOSS_SPAWN_BEGINNER_MAX_DELAY_MS = 1_320_000; // 22 min
const BEGINNER_LEVEL_THRESHOLD = 2;
const BOSS_FULL_RANDOM_WEIGHT_PERCENT = 20;
const BOSS_HIGHEST_PLUS_ONE_WEIGHT_PERCENT = 30;
/** Chance that arming a fight countdown also rolls a ring event. */
const RING_EVENT_CHANCE_PERCENT = 25;

/** Why the ring is refusing another boss right now. */
export type BossRefusalReason = 'in_encounter' | 'boss_cap' | 'ring_full';

/**
 * Calculates the max XP that still maps to `targetLevel` via `getLevel()`.
 * Level 0 cap is 49, level 1 cap is 99, level 2 cap is 149, etc.
 */
export const getXpCapForLevel = (targetLevel: number): number => {
	const normalizedLevel = Math.max(0, Math.floor(targetLevel));
	let lower = 0;
	let upper = 1;

	// Expand the search window until it strictly exceeds the target level.
	while (getLevel(upper) <= normalizedLevel) {
		lower = upper;
		upper *= 2;
	}

	// Binary search for the highest XP whose computed level is still <= target.
	while (lower + 1 < upper) {
		const mid = Math.floor((lower + upper) / 2);
		if (getLevel(mid) <= normalizedLevel) {
			lower = mid;
		} else {
			upper = mid;
		}
	}

	return lower;
};

/** One contestant's live stats, as broadcast on `ring.state` for the roster UI. */
export interface RingContestantSnapshot {
	name: string;
	icon: string;
	creatureType: string;
	level: number;
	hp: number;
	maxHp: number;
	ac: number;
	dead: boolean;
	isBoss: boolean;
	team: string | null;
	/** Owning player's display name; null for bosses, which have no owner. */
	owner: string | null;
	/** Owning player's user id, so a client can highlight "your" monsters. */
	userId: string | null;
	/** True for the single contestant currently taking their turn, so a client can highlight it. */
	acting: boolean;
	/**
	 * The monster's appearance as its Beastmaster described it ("gold and black", "slightly
	 * translucent blue"), or a random colour name for a boss. The web colours each pixel
	 * sprite from it, so two monsters of one species in a ring do not look identical — see
	 * docs/architecture/ring-roster-and-pixel-monsters.md. Already public through `look at`;
	 * empty when a monster has none. Capped because it is free text broadcast to the whole room.
	 */
	appearance: string;
	/**
	 * The exact colour behind a generated boss's appearance, as `#rrggbb`; null for a player's
	 * monster, whose appearance is words. Boss appearances are names from `grab-color-names`
	 * ("Sazerac", "Deep Fir") that a colour-word parser mostly cannot read.
	 */
	appearanceHex: string | null;
}

/** Longest appearance sent on `ring.state`. The workshop form allows 100; other flows do not cap it. */
export const SNAPSHOT_APPEARANCE_MAX = 100;

/** A monster's stored `colorHex`, if it is a well-formed `#rrggbb`. */
export function appearanceHexOf(monster: { options?: Record<string, unknown> } | undefined): string | null {
	const hex = monster?.options?.colorHex;
	return typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : null;
}

export interface Contestant {
	monster: any;
	character: any;
	userId: string;
	isBoss?: boolean;
	/**
	 * Per-encounter overrides applied by a ring event. These live on the contestant rather
	 * than the monster because `monster.team` / `monster.targetingStrategy` are
	 * `options`-backed and would persist into the room's state blob. `clearRing()` wipes
	 * contestants after every fight, so these are inherently temporary.
	 */
	team?: string;
	targetingStrategy?: string;
	won?: boolean;
	lost?: boolean;
	fled?: boolean;
	killed?: any;
	killedBy?: any;
	rounds?: number;
	encounter?: any;
	round?: number;
	/**
	 * Tracks a player-initiated summon: set when `summon a boss` creates this contestant.
	 * If the boss is removed before a fight starts (last player withdraws, despawn timer
	 * fires) the charge recorded in `bossSummons` should be refunded — the game's
	 * `onSummonedBossRemoved` callback handles that. Not set for timer/admin/Gauntlet bosses.
	 * Ephemeral: lives on the contestant only; never persisted (bosses are not serialized).
	 */
	summonedByUserId?: string;
	summonedAt?: number;
}

/**
 * Returns the faction label for a contestant: contestant-level team override first
 * (from a ring event like Common Cause/House War), then monster.team, then
 * character.team, then the contestant's own userId (teamless = own faction).
 *
 * Extracted to module level so both `Ring.fight()` (for isLastTeamVictory) and
 * `Ring.fightConcludes()` (for isLastTeamFledWin) can share the exact same logic.
 */
function factionOf(c: Contestant): string {
	return (
		c.team ||
		(c.monster as any).team ||
		(c.character as any).team ||
		c.userId
	);
}

function participantOutcome(
	contestant: Contestant,
	hasDecisiveWinner: boolean
): 'win' | 'loss' | 'draw' | 'fled' | 'permaDeath' {
	if (contestant.monster.destroyed) return 'permaDeath';
	// A dead contestant is always counted in `deaths` (it is `deadContestants.length`),
	// so death is unconditionally a loss — even on an otherwise inconclusive fight.
	if (contestant.monster.dead) return 'loss';
	if (contestant.fled) return 'fled';
	// Living survivors only count as winners when the fight actually decided a victor
	// (one last contestant, or one last team). Round-cap / inconclusive ends are draws
	// even if someone died earlier — otherwise both remaining factions get "win".
	if (hasDecisiveWinner) return 'win';
	return 'draw';
}

export class Ring extends BaseClass {
	private bossOnlyPacingEngaged = false;
	static eventPrefix = 'ring';

	log: (err: unknown) => void;
	spawnBosses: boolean;
	ringEventsEnabled: boolean;
	eventBus: RoomEventBus;
	private readonly roomMonsterLevelsProvider?: () => number[];
	inEncounter: boolean = false;
	encounter?: Record<string, any>;
	/**
	 * The contestant currently taking their turn, so the roster UI can highlight whose
	 * turn it is. Ephemeral like `inEncounter`/`encounter` — never options-backed, never
	 * serialized. Set in `fight()` right before `playerTurnBegin`, cleared at the start
	 * and end of every encounter.
	 */
	activeContestant?: Contestant;
	fightTimer?: ReturnType<typeof setTimeout>;
	bossTimer?: ReturnType<typeof setTimeout>;
	/** Pending per-boss despawn timers, so `dispose()` can cancel all of them. */
	private readonly bossDespawnTimers = new Set<ReturnType<typeof setTimeout>>();
	/** Epoch ms when the next boss will enter the ring (including the 2-min announcement window), or null if no timer is running. */
	nextBossSpawnAt: number | null = null;
	/** Epoch ms when the next fight will start, or null if no fight timer is active. */
	nextFightAt: number | null = null;
	/**
	 * Ring event in force for the upcoming fight, if any. A plain instance field (like
	 * `inEncounter`) so it is never serialized; rolled by `startFightTimer()`, applied by
	 * `startEncounter()`, cleared by `clearRing()`.
	 */
	ringEvent?: RingEventDefinition;

	/**
	 * Stub satisfying legacy card code that calls `ring.channelManager.sendMessages()`.
	 * In the TypeScript connector all messaging goes through the eventBus; this shim
	 * prevents crashes in cards like Berserk and Flee that call it unconditionally.
	 */
	readonly channelManager = {
		sendMessages: (): Promise<void> => Promise.resolve(),
		queueMessage: (): Promise<void> => Promise.resolve(),
	};

	constructor(
		eventBus: RoomEventBus,
		{
			spawnBosses = true,
			ringEvents = true,
			getRoomMonsterLevels,
			...options
		}: {
			spawnBosses?: boolean;
			ringEvents?: boolean;
			getRoomMonsterLevels?: () => number[];
			[key: string]: unknown;
		} = {},
		log: (err: unknown) => void = () => {}
	) {
		super(options);

		this.log = log;
		this.spawnBosses = spawnBosses;
		this.ringEventsEnabled = ringEvents;
		this.eventBus = eventBus;
		this.roomMonsterLevelsProvider = getRoomMonsterLevels;
		if (!Array.isArray((this.options as any).battles)) {
			this.setOptions({ battles: [] } as any);
		}

		this.on('fightConcludes', (_className: string, ring: Ring, results: any) => {
			const current: any[] = (ring.options as any).battles || [];
			const updated = [...current, results].slice(-20);
			ring.setOptions({ battles: updated } as any);
		});

		// Route outcome events back to ring handlers via event bus
		this.eventBus.subscribe('ring-internal', {
			// Outcome events are private to their owners. This trusted room-local dispatcher
			// must still observe them so it can update records and emit creature outcomes.
			includePrivate: true,
			deliver: (event) => {
				if (event.type === 'ring.win') {
					this.handleWinner({ contestant: (event.payload as any).contestant });
				} else if (event.type === 'ring.loss') {
					this.handleLoser({ contestant: (event.payload as any).contestant });
				} else if (event.type === 'ring.permaDeath') {
					this.handlePermaDeath({ contestant: (event.payload as any).contestant });
				} else if (event.type === 'ring.draw') {
					this.handleTied({ contestant: (event.payload as any).contestant });
				} else if (event.type === 'ring.fled') {
					this.handleFled({ contestant: (event.payload as any).contestant });
				}
			}
		});

		this.startBossTimer();
	}

	private pub(
		type: Parameters<RoomEventBus['publish']>[0]['type'],
		text: string,
		payload: Record<string, unknown> = {},
		targetUserId?: string
	): void {
		this.eventBus.publish({
			type,
			scope: targetUserId ? 'private' : 'public',
			text,
			payload,
			...(targetUserId ? { targetUserId } : {}),
		});
	}

	get battles(): any[] {
		return (this.options as any).battles || [];
	}

	get contestants(): Contestant[] {
		return (this.options as any).contestants || [];
	}

	set contestants(contestants: Contestant[]) {
		this.setOptions({ contestants } as any);
	}

	get encounterEffects(): any[] {
		return (this.encounter || {}).effects || [];
	}

	set encounterEffects(effects: any[]) {
		this.encounter = {
			...this.encounter,
			effects,
		};
	}

	getMonsters(targetCharacter?: any): any[] {
		let targetContestants = this.contestants;
		if (targetCharacter) {
			targetContestants = targetContestants.filter(
				contestant => contestant.character === targetCharacter
			);
		}

		return targetContestants.map(contestant => contestant.monster);
	}

	removeMonster({
		monster,
		character,
		userId,
	}: {
		monster: any;
		character: any;
		userId: string;
	}): Promise<void> {
		return Promise.resolve()
			.then(() => {
				if (this.inEncounter) {
					this.pub('announce', 'You cannot withdraw while a fight is in progress', {}, userId);
					return Promise.reject(new Error('Encounter in progress'));
				}

				if (this.contestants.length <= 0) {
					this.pub('announce', 'No monsters currently in ring', {}, userId);
					return Promise.reject(new Error('Ring is empty'));
				}

				if (!monster || !monster.givenName) {
					this.pub('announce', 'No monster specified to remove from ring', {}, userId);
					return Promise.reject(new Error('No monster specified'));
				}

				const contestant = this.findContestant(character, monster);
				if (!contestant) {
					this.pub('announce', 'Your monster is not currently in the ring', {}, userId);
					return Promise.reject(new Error('Monster not in ring'));
				}

				return contestant;
			})
			.then((contestant: Contestant) => {
				// Go through the `contestants` setter (setOptions) rather than mutating
				// the live array in place: an in-place splice never emits `stateChange`,
				// so a monster withdrawn without any other room activity afterward could
				// still be listed in the last-persisted `ringContestantRefs` and get
				// re-hydrated back into the ring on the next restart.
				const updated = [...this.contestants];
				const contestantIndex = updated.indexOf(contestant);
				updated.splice(contestantIndex, 1);
				this.contestants = updated;
				this.disposeTransientContestant(contestant);

				if (this.contestants.length < 1) {
					this.clearRing();
				}

				this.emit('remove', { contestant });

				this.pub(
					'ring.remove',
					`${monster.givenName} has returned to nestle safely into your warm embrace.`,
					{ contestant },
					userId
				);

				this.startFightTimer();

				// When the last player leaves, proactively remove player-summoned bosses
				// so their charges are refunded immediately rather than waiting for the
				// 10-minute despawn timer. Non-summoned (timer/admin/Gauntlet) bosses are
				// left for their own timers. No-op during encounters (rejected above).
				if (!contestant.isBoss) {
					const hasPlayers = this.contestants.some(c => !c.isBoss);
					if (!hasPlayers) {
						const summonedBosses = this.contestants.filter(
							c => c.isBoss && c.summonedByUserId !== undefined
						);
						if (summonedBosses.length > 0) {
							return summonedBosses.reduce(
								(p, boss) => p.then(() => this.removeBoss(boss)),
								Promise.resolve() as Promise<void>
							);
						}
					}
				}
			});
	}

	addMonster({
		monster,
		character,
		userId,
		isBoss,
		deferFightTimer,
		summonedByUserId,
		summonedAt,
	}: {
		monster: any;
		character: any;
		userId: string;
		isBoss?: boolean;
		/**
		 * Skip the `startFightTimer()` call. Only used when the caller is already inside
		 * `startFightTimer()` (the Gauntlet ring event) — re-entering it there would arm a
		 * second, untracked fight timer on top of the one the outer call is about to set.
		 */
		deferFightTimer?: boolean;
		/** Set when this is a player-summoned boss — used to trigger a charge refund if the boss is removed pre-fight. */
		summonedByUserId?: string;
		summonedAt?: number;
	}): void {
		if (this.contestants.length < MAX_MONSTERS && !this.inEncounter) {
			// Boss identity has two readers: the roster (`Contestant.isBoss`, used by ring
			// events and `contestantSnapshots`) and the combat DTOs on public events
			// (`toCombatActor` reads `monster.isBoss`). Timed bosses arrive with the flag
			// already set by `randomCharacter`, but a caller may pass it only here — copy it
			// onto the monster so the two never disagree about who the boss is.
			if (isBoss && !monster.isBoss) monster.setOptions({ isBoss: true });

			const contestant: Contestant = {
				monster,
				character,
				userId,
				isBoss,
				...(summonedByUserId !== undefined ? { summonedByUserId } : {}),
				...(summonedAt !== undefined ? { summonedAt } : {}),
			};

			this.contestants = process.env.DECK_MONSTERS_DETERMINISTIC_RING
				? [...this.contestants, contestant]
				: shuffle([...this.contestants, contestant]);

			// Pre-flight: warn if any card is a plain object without a play() method.
			// This surfaces hydration failures before the fight starts rather than mid-combat.
			for (let i = 0; i < monster.cards.length; i++) {
				const c = monster.cards[i];
				if (typeof c?.play !== 'function') {
					this.log({
						context: 'ring.addMonster.cardValidation',
						monsterName: monster.givenName,
						monsterConstructor: monster?.constructor?.name,
						cardIndex: i,
						cardConstructor: c?.constructor?.name ?? 'unknown',
						cardKeys: c ? Object.keys(c) : [],
						hasPlay: typeof c?.play,
						cardJSON: JSON.stringify(c)?.slice(0, 200),
					});
				}
			}

			this.emit('add', { contestant });
			if (!deferFightTimer) this.startFightTimer();
		} else {
			this.pub(
				'announce',
				'The ring is full! Wait until the current fight is over and try again.',
				{},
				userId
			);
		}
	}

	monsterIsInRing(monster: any): boolean {
		return !!this.contestants.find(contestant => contestant.monster === monster);
	}

	findContestant(character: any, monster: any): Contestant | undefined {
		return this.contestants.find(
			contestant => contestant.character === character && contestant.monster === monster
		);
	}

	look(userId: string, showCharacters = true, summary = false): Promise<void> {
		const { length } = this.contestants;

		if (length < 1) {
			this.pub('announce', 'The ring is empty.', {}, userId);
			return Promise.reject(new Error('The ring is empty.'));
		}

		if (summary) {
			const monsters = this.contestants.map(
				({ monster }) =>
					`${monster.identity} - ${monster.creatureType} (${monster.displayLevel.replace('level ', '')})`
			);

			this.pub(
				'announce',
				`###########################################\n${monsters.join('\n')}\n###########################################`,
				{},
				userId
			);
			return Promise.resolve();
		}

		this.pub(
			'announce',
			`###########################################\nThere ${length === 1 ? 'is one contestant' : `are ${length} contestants`} in the ring.\n###########################################`,
			{},
			userId
		);

		this.contestants.forEach(contestant => {
			let characterDisplay = '';
			if (showCharacters) {
				characterDisplay = `${monsterCard(contestant.character, true)}\nSent the following monster into the ring:\n\n`;
			}

			const monsterDisplay = monsterCard(contestant.monster, !showCharacters);

			this.pub(
				'announce',
				`${characterDisplay}${monsterDisplay}###########################################`,
				{},
				userId
			);
		});

		return Promise.resolve();
	}

	lookAtCards(userId: string): Promise<void> {
		const { length } = this.contestants;

		if (length < 1) {
			this.pub('announce', 'The ring is empty.', {}, userId);
			return Promise.reject(new Error('The ring is empty.'));
		}

		if (!this.inEncounter) {
			this.pub('announce', 'Wait until the fight has started.', {}, userId);
			return Promise.reject(new Error('Encounter not started.'));
		}

		this.pub('announce', `###########################################\nThe following cards are in play:\n`, {}, userId);

		const cards = sortCardsAlphabetically(
			uniqueCards(
				this.contestants.reduce((allCards: any[], { monster }: Contestant) => {
					allCards.push(...monster.cards);
					return allCards;
				}, [])
			)
		);

		cards.forEach((card: any) => {
			this.pub('announce', actionCard(card, true), {}, userId);
		});

		this.pub('announce', '###########################################', {}, userId);

		return Promise.resolve();
	}

	startEncounter(): boolean {
		if (this.inEncounter) return false;

		this.bossOnlyPacingEngaged = false;
		this.inEncounter = true;
		this.encounter = {};
		this.activeContestant = undefined;

		// Apply the ring event against the final roster — contestants may have joined or
		// withdrawn since it was rolled during the countdown.
		this.ringEvent?.apply(this.contestants);

		this.contestants.forEach(({ userId, monster }) => {
			monster.startEncounter(this);

			this.pub(
				'announce',
				'The fight has begun! You may now type `look at monsters in the ring` to see all participants with their current stats, and `look at cards in the ring` to see the detailed stats of every card that will be in play.',
				{},
				userId
			);
		});

		// Surface the starting board (and inEncounter) before the first card lands.
		this.publishState();

		return true;
	}

	endEncounter(): void {
		this.contestants.forEach(contestant => contestant.monster.endEncounter());
		this.inEncounter = false;
		delete this.encounter;
		this.activeContestant = undefined;
		// Post-fight HP is what players check between rounds; publish the final board.
		this.publishState();
	}

	/**
	 * Live per-contestant stats for the ring roster UI.
	 *
	 * The narration already reports HP and AC, but only as prose scattered through
	 * the feed ("Aqim has 40HP"), so following a multi-monster fight meant scrolling
	 * back and reconstructing the board by hand — unreadable on a phone. This is the
	 * same data `look at monsters in the ring` prints, shaped for a client to render
	 * as a persistent panel.
	 *
	 * `ac` is read through the live getter so per-encounter boosts are reflected as
	 * they change; `team` and `targetingStrategy` come off the contestant rather than
	 * the monster because ring events set them per-encounter (see `Contestant`).
	 * `acting` flags the single contestant currently taking their turn (from
	 * `activeContestant`), so a client can highlight whose turn it is.
	 */
	contestantSnapshots(): RingContestantSnapshot[] {
		return this.contestants.map(({ monster, character, userId, isBoss, team }) => ({
			name: monster.givenName,
			icon: monster.icon ?? '',
			creatureType: monster.creatureType,
			level: monster.level,
			hp: monster.hp,
			maxHp: monster.maxHp,
			ac: monster.ac,
			dead: monster.dead,
			isBoss: Boolean(isBoss),
			team: team ?? null,
			owner: isBoss ? null : (character?.givenName ?? null),
			userId: isBoss ? null : (userId ?? null),
			acting: this.inEncounter && this.activeContestant?.monster === monster,
			appearance: typeof monster.color === 'string' ? monster.color.slice(0, SNAPSHOT_APPEARANCE_MAX) : '',
			appearanceHex: appearanceHexOf(monster),
		}));
	}

	/** Boss-only cleanup stays at double pace once no human contestant can still act. */
	get pacingMultiplier(): number {
		if (!this.inEncounter) return 1;
		if (this.bossOnlyPacingEngaged) return 2;
		const active = this.contestants.filter(({ monster }) => !monster.dead && !monster.fled);
		const activeHumans = active.some(contestant => !contestant.isBoss);
		const activeBosses = active.filter(contestant => contestant.isBoss).length;
		this.bossOnlyPacingEngaged = !activeHumans && activeBosses >= 2;
		return this.bossOnlyPacingEngaged ? 2 : 1;
	}

	private paced(ms: number): number {
		return Math.round(ms / this.pacingMultiplier);
	}

	/** Publish current ring timer state to all connected clients via the event bus. */
	publishState(): void {
		this.eventBus.publish({
			type: 'ring.state',
			scope: 'public',
			text: '',
			payload: {
				nextFightAt: this.nextFightAt,
				nextBossSpawnAt: this.nextBossSpawnAt,
				monsterCount: this.contestants.length,
				inEncounter: this.inEncounter,
				contestants: this.contestantSnapshots(),
			},
		});
	}

	clearRing(): void {
		clearTimeout(this.fightTimer);
		this.fightTimer = undefined;
		this.nextFightAt = null;
		this.ringEvent = undefined;
		this.endEncounter();
		for (const contestant of this.contestants) {
			this.disposeTransientContestant(contestant);
		}
		for (const timer of this.bossDespawnTimers) {
			clearTimeout(timer);
		}
		this.bossDespawnTimers.clear();
		this.contestants = [];
		this.emit('clear');
		this.publishState();
	}

	/**
	 * Stop the background timers of a contestant nobody else owns.
	 *
	 * Bosses (and harness sim monsters, which are built as bosses) are created by the
	 * ring and belong to no beastmaster, so once the ring lets go of them the healing
	 * interval and any respawn timer would leak forever — `Game.dispose()` never sees
	 * them. Player monsters are the opposite: they live on in their beastmaster's
	 * roster and MUST keep healing and reviving after the ring releases them. Disposing
	 * them here (which every fight did via `clearRing()`) is what left revived monsters
	 * parked at 1 hp for hours until the room was restored from state (#156).
	 */
	private disposeTransientContestant({ monster, character, isBoss }: Contestant): void {
		if (!isBoss) return;
		(monster as { disposeTimers?: () => void })?.disposeTimers?.();
		(character as { disposeTimers?: () => void })?.disposeTimers?.();
	}

	dispose(): void {
		clearTimeout(this.fightTimer);
		clearTimeout(this.bossTimer);
		for (const timer of this.bossDespawnTimers) {
			clearTimeout(timer);
		}
		this.bossDespawnTimers.clear();
		this.fightTimer = undefined;
		this.bossTimer = undefined;
		this.nextFightAt = null;
		this.nextBossSpawnAt = null;
		this.eventBus.unsubscribe('ring-internal');
	}

	startFightTimer(): void {
		clearTimeout(this.fightTimer);
		this.nextFightAt = null;

		const getPlayerContestants = (): {
			contestants: Contestant[];
			numberOfMonstersInRing: number;
		} => {
			let hasBoss = false;
			const playerContestants = this.contestants.filter(contestant => {
				if (contestant.isBoss) {
					hasBoss = true;
					return false;
				}

				return true;
			});

			return {
				contestants: playerContestants,
				numberOfMonstersInRing: playerContestants.length + (hasBoss ? 1 : 0),
			};
		};

		const { contestants, numberOfMonstersInRing } = getPlayerContestants();

		if (numberOfMonstersInRing >= MIN_MONSTERS) {
			this.rollRingEvent();

			contestants.forEach(({ userId }) =>
				this.pub(
					'ring.countdown',
					`Fight will begin in ${Math.floor(FIGHT_DELAY / 1000)} seconds.`,
					{},
					userId
				)
			);

			this.nextFightAt = Date.now() + FIGHT_DELAY;
			this.publishState();
			this.fightTimer = setTimeout(() => {
				this.nextFightAt = null;
				const { numberOfMonstersInRing: numberOfMonstersStillInRing } =
					getPlayerContestants();

				if (numberOfMonstersStillInRing >= MIN_MONSTERS) {
					this.fight();
				}
			}, FIGHT_DELAY);
		} else if (numberOfMonstersInRing <= 0) {
			// Quorum gone: abort any queued event so a future roster cannot inherit a stale
			// event that was rolled for a completely different set of contestants.
			// See docs/architecture/boss-encounters.md §4 (Finding 4 — quorum-drop guard).
			this.ringEvent = undefined;
			this.emit('narration', {
				narration: 'The ring is quiet save for the faint sound of footsteps fleeing into the distance.',
			});
			this.publishState();
		} else {
			// Below quorum but not empty: same reasoning — clear the event. If quorum is
			// restored later, startFightTimer() re-runs and rolls a fresh event for whoever
			// is actually in the ring at that point.
			this.ringEvent = undefined;
			const needed = MIN_MONSTERS - numberOfMonstersInRing;
			const monster = needed > 1 ? 'monsters' : 'monster';
			const join = needed > 1 ? 'join' : 'joins';

			contestants.forEach(({ userId }) =>
				this.pub(
					'announce',
					`Fight countdown will begin once ${needed} more ${monster} ${join} the ring.`,
					{},
					userId
				)
			);
			this.publishState();
		}
	}

	fight(): Promise<void> {
		const ring = this;
		const fightLog: string[] = [];

		if (!this.startEncounter()) return Promise.resolve();

		const contestants = [...this.contestants];

		// Publish fight-start event so server-side subscribers (e.g. fight-summary-writer)
		// can record the accurate startedAt timestamp for this fight.
		this.eventBus.publish({
			type: 'ring.fight',
			scope: 'public',
			text: `Fight begins with ${contestants.length} contestants`,
			payload: { contestants, eventName: 'fightBegins' },
		});

		const isActiveContestant = (contestant: Contestant | undefined): boolean =>
			!!(contestant && !contestant.monster.dead && !contestant.monster.fled);
		const getActiveContestants = (currentContestants: Contestant[]): Contestant[] =>
			currentContestants.filter(isActiveContestant);
		const getAllActiveContestants = (): Contestant[] => getActiveContestants(contestants);
		const getContestantsWithCardsLeft = (currentContestants: Contestant[]): Contestant[] =>
			currentContestants.filter(contestant => contestant && !contestant.monster.emptyHanded);
		const anyContestantsHaveCardsLeft = (currentContestants: Contestant[]): boolean =>
			getContestantsWithCardsLeft(currentContestants).length > 0;

		// Use the module-level factionOf helper so fight() and fightConcludes() share
		// identical faction resolution logic.

		/**
		 * True when last-team victory mode is active AND all remaining active contestants
		 * are in the same faction. An empty active list is not a last-team victory (it is
		 * a draw or clean sweep, handled by the existing length ≤ 1 path).
		 */
		const isLastTeamVictory = (active: Contestant[]): boolean => {
			if (this.ringEvent?.victoryMode !== 'last-team') return false;
			if (active.length === 0) return false;
			const factions = new Set(active.map(factionOf));
			return factions.size === 1;
		};

		/**
		 * True when the fight should continue — more than one active contestant remains
		 * AND (in last-team mode) they are still from multiple factions.
		 */
		const fightContinues = (active: Contestant[]): boolean =>
			active.length > 1 && !isLastTeamVictory(active);

		// The fight's opening used to stack four banners with zero pacing between them:
		// the `ring.fight` bookkeeping line published above, the "Let the games begin!"
		// banner from `fight` (emitted synchronously below), and — inside the first
		// `doAction()` call — the startTurn and playerTurnBegin banners, all landing
		// before the first `turnBeat()` await (which only separates playerTurnBegin from
		// the card box). `turnBeat` is already content-aware (sized by whatever was just
		// published via `pacing-context.ts`), so reusing it here paces the opening at the
		// same tier as the turn-banner-to-card-box gap it already covers, without
		// reordering any narration. See docs/architecture/engine-concurrency-and-timing.md §1.
		const openingBeat = (): Promise<void> => turnBeat(this.pacingMultiplier);

		let round = 1;
		let turn: number | undefined;

		const doAction = ({
			currentContestants = contestants,
			cardIndex = 0,
		}: { currentContestants?: Contestant[]; cardIndex?: number } = {}): Promise<
			Contestant | undefined
		> =>
			new Promise((resolve, reject) => {
				let activeContestants = getActiveContestants(currentContestants);
				let nextCardIndex = cardIndex;

				const next = (): void => {
					resolve(doAction({ currentContestants: activeContestants, cardIndex: nextCardIndex }));
				};

				const globalActive = getAllActiveContestants();

				// Check last-team victory BEFORE the batch-rebuild logic so we never
				// recurse. With ≥2 same-faction survivors the old combined condition
				// `activeContestants.length <= 1 || isLastTeamVictory(globalActive)`
				// always fell into the else-branch and called next(), which called
				// doAction again, which called next() again — infinite recursion.
				if (isLastTeamVictory(globalActive)) {
					// One faction stands. Resolve without recursion; fightConcludes
					// marks every living contestant as won. No single lastContestant.
					resolve(undefined);
					return;
				}

				// Only rebuild when the local batch is empty. A single remaining
				// contestant still needs to play their card at the current index;
				// after they act, the next invocation hits this empty-batch path.
				// (The old length===1 branch prepended the survivor onto globalActive,
				// which already contained them — duplicates that skewed turn order.
				// Assigning `activeContestants = globalActive` here and falling through
				// is also wrong: it makes someone who already acted replay this index
				// while the true survivor is skipped.)
				if (activeContestants.length === 0) {
					nextCardIndex += 1;
					// Batch exhausted — rebuild from the global active list and
					// continue to the next card index.
					activeContestants = globalActive;
					next();
					return;
				}

				const playerContestant = activeContestants.shift()!;
				const { monster: player } = playerContestant;
				const card = player.cards[cardIndex];

				if (card) {
					// Only the fight's very first turn needs an extra beat before
					// playerTurnBegin: every later startTurn (a new round of turns) already
					// follows a card-to-card/round gap from the previous card's resolution
					// (see `next()` continuations below), so gating on `turn === undefined`
					// avoids double-pacing those.
					const isFightOpening = turn === undefined;

					if (turn !== cardIndex) {
						turn = cardIndex;

						this.emit('startTurn', {
							turn,
							contestants: getAllActiveContestants(),
							round,
						});
					}

					const beginTurn = (): void => {
						// Set before the emit (not after) so any listener reacting to
						// `playerTurnBegin` already sees the correct actor, then publish once
						// here so the roster highlight of whose turn it is lands before the
						// card box does. One extra publish per turn is negligible next to the
						// per-card publish already below.
						this.activeContestant = playerContestant;
						this.emit('playerTurnBegin', { contestant: playerContestant, round });
						this.publishState();

						const targetResult = getTarget({
							contestants: getAllActiveContestants(),
							playerContestant,
							// A ring event's override beats the monster's own scroll-assigned strategy.
							strategy:
								playerContestant.targetingStrategy ?? playerContestant.monster.targetingStrategy,
							// Blood Feud drops team alignment for everyone.
							...(this.ringEvent?.freeForAll ? { team: false as const } : {}),
						});
						// TARGET_ALL_CONTESTANTS resolves to an array rather than a single contestant.
						// No monster should carry it as a strategy, but now that ring events assign
						// strategies programmatically, fall back rather than dereference undefined.
						const targetContestant = (
							Array.isArray(targetResult) ? targetResult[0] : targetResult
						) as Contestant | undefined;

						if (!targetContestant) {
							this.log({
								context: 'ring.fight.noTarget',
								monsterName: player.givenName,
								strategy:
									playerContestant.targetingStrategy ?? playerContestant.monster.targetingStrategy,
							});
							if (fightContinues(getAllActiveContestants())) {
								if (delaysAreSkipped()) {
									queueMicrotask(() => next());
								} else {
									setTimeout(() => next(), this.paced(veryShortDelay(round)));
								}
							} else {
								resolve(playerContestant);
							}
							return;
						}

						const { monster: proposedTarget } = targetContestant;

						playerContestant.round = round;

						fightLog.push(
							`${player.givenName}: ${card.name} target ${proposedTarget.givenName}`
						);

						// Guard: if card is a plain object (hydration failure), skip it gracefully.
						if (typeof card.play !== 'function') {
							this.log({
								context: 'ring.fight.invalidCard',
								monsterName: player.givenName,
								monsterConstructor: player?.constructor?.name,
								cardIndex,
								cardConstructor: card?.constructor?.name ?? 'unknown',
								cardKeys: Object.keys(card),
								cardName: card?.name,
								typeof_play: typeof card?.play,
								cardJSON: JSON.stringify(card)?.slice(0, 300),
							});
							if (fightContinues(getAllActiveContestants())) {
								if (delaysAreSkipped()) {
									queueMicrotask(() => next());
								} else {
									setTimeout(() => next(), this.paced(veryShortDelay(round)));
								}
							} else {
								resolve(playerContestant);
							}
							return;
						}

						// Let the turn banner land before the card box does. `playerTurnBegin`
						// publishes the player's monster stat card — measured at 19–34 rendered
						// lines — and `card.play` immediately publishes another ten-line card box,
						// so the two arrived together with a 0.0s gap: forty-odd lines at once,
						// followed by the whole pause. Sized by `subEventDelayMs`, which scales
						// with the banner just emitted, so a long stat card buys more reading time.
						turnBeat(this.pacingMultiplier)
							.then(() => card.play(player, proposedTarget, ring, getAllActiveContestants()))
							.then(() => {
								// Push the board after every resolved card so the roster's HP/AC
								// track the narration. One publish per card matches the feed's own
								// card-to-card pacing (veryShortDelay below), so this adds no
								// meaningful traffic next to the announce lines already going out.
								this.publishState();

								if (fightContinues(getAllActiveContestants())) {
									if (delaysAreSkipped()) {
										return subEventDelay(this.pacingMultiplier).then(() => next());
									}
									// Pace card-to-card transitions with the configured very-short
									// delay so live feeds can be followed; sub-events within a card
									// already pace themselves via subEventDelay(). `remainingGapMs`
									// subtracts the pause the card's final sub-event just took, so
									// the boundary is that delay rather than the sum of both — the
									// stacked version measured 6.8s at p90 and up to 10.3s, landing
									// straight after the damage result.
									return new Promise<void>(r =>
										setTimeout(r, remainingGapMs(this.paced(veryShortDelay(round))))
									).then(() => next());
								}

								return Promise.resolve().then(() => resolve(playerContestant));
							})
							.catch((ex: unknown) => {
								// Cards can mutate HP/AC before throwing. Publish the resulting board
								// just as the success path does so a partial failure cannot freeze the
								// live roster while narration continues with newer values.
								this.publishState();
								this.log({
									err: ex,
									context: 'card.play',
									card: card.name,
									player: player.givenName,
									target: proposedTarget.givenName,
								});
								// Skip the failed card and continue the fight rather than crashing
								if (fightContinues(getAllActiveContestants())) {
									if (delaysAreSkipped()) {
										return subEventDelay(this.pacingMultiplier).then(() => next());
									}
									return new Promise<void>(r =>
										setTimeout(r, remainingGapMs(this.paced(veryShortDelay(round))))
									).then(() => next());
								}
								return Promise.resolve().then(() => resolve(playerContestant));
							});
					};

					// The fight's opening also stacks startTurn and playerTurnBegin into the
					// same tick; reuse the same content-aware beat so the whole opening reads
					// at one consistent pace. Every later startTurn is already paced by the
					// previous card's card-to-card/round gap (see `isFightOpening` above).
					//
					// This chain is detached from the executor's synchronous body — unlike
					// `beginTurn()` called directly in the `else` branch below, whose throw
					// the Promise constructor auto-catches, a throw inside this `.then()`
					// callback (e.g. a `playerTurnBegin` listener throwing on the fight's
					// very first turn) runs in a later microtask the constructor can no
					// longer see. Without `.catch(reject)` that became an unhandled
					// rejection AND left this `doAction()` promise forever unsettled —
					// `fight()`'s own `.catch` (the cancelled/error path) never ran. Routing
					// it through `reject` instead settles this promise like any other
					// mid-fight throw. See docs/architecture/engine-concurrency-and-timing.md §1.
					if (isFightOpening) {
						openingBeat().then(beginTurn).catch(reject);
					} else {
						beginTurn();
					}
				} else {
					this.emit('endOfDeck', { contestant: playerContestant, round });

					player.emptyHanded = true;

					const allActiveContestants = getAllActiveContestants();
					// Only a genuine round rollover earns the round-sized gap. Reaching the
					// end of one contestant's deck is a one-line housekeeping notice.
					let roundRolledOver = false;
					if (!anyContestantsHaveCardsLeft(allActiveContestants)) {
						roundRolledOver = true;
						this.emit('roundComplete', { contestants, round });

						if (round === 10) {
							this.pub('announce', 'The fight has ended in a draw after 10 rounds — no monsters could finish the job.', {});
							resolve(undefined);
							return;
						}

						round += 1;

						allActiveContestants.forEach(({ monster }) => {
							monster.emptyHanded = false;
							monster.round = round;
						});

						nextCardIndex = 0;
						activeContestants = allActiveContestants;
					}

					// Same de-stacking as the card-to-card gap above: the banner has just
					// been emitted, so wait only the remainder of the target gap.
					//
					// A round rollover is a real beat and gets the round-sized delay. A
					// plain "X is out of cards" is not: it used to take the same gap, so a
					// fight where several contestants emptied their decks in a row produced
					// consecutive 9–10s waits separated by a single line of text — measured
					// as the longest pauses in the whole feed, and reading as a stall.
					// "X is out of cards" lines belong together: several contestants empty
					// their decks back to back, and giving each one a full gap drip-fed the
					// feed with consecutive 9–10s waits separated by a single line. They
					// now arrive as a group on a short beat, and the real pause comes once,
					// after the group, at the round rollover that follows it.
					const waitMs = roundRolledOver
						? remainingGapMs(this.paced(shortDelay(round)))
						: remainingGapMs(this.paced(groupedBeatMs()));
					if (delaysAreSkipped()) {
						queueMicrotask(() => next());
					} else {
						setTimeout(() => next(), waitMs);
					}
				}
			});

		return openingBeat()
			.then(() => {
				this.emit('fight', { contestants });
				return openingBeat();
			})
			.then(() => doAction())
			.then(lastContestant => {
				this.fightConcludes({ fightLog, lastContestant, rounds: round });
				this.clearRing();
			})
		.catch((err: unknown) => {
			this.log({
				err,
				context: 'ring.fight',
				contestants: this.contestants.map(c => c.monster.givenName),
			});
			this.pub(
				'announce',
				'The fight has been cancelled due to an unexpected error. The ring has been cleared.',
				{}
			);
			// Publish a terminal event so FightSummaryWriter's pending 'ring.fight'
			// start (published above) doesn't linger forever, and so a cancelled
			// fight shows up in the fight log instead of vanishing silently.
			this.eventBus.publish({
				type: 'ring.fightResolved',
				scope: 'public',
				text: 'Fight cancelled due to an unexpected error',
				payload: {
					rounds: round,
					deaths: 0,
					outcome: 'cancelled',
					participants: [],
				},
			});
			this.clearRing();
		});
	}

	fightConcludes({
		lastContestant,
		rounds,
	}: {
		fightLog?: string[];
		lastContestant?: Contestant;
		rounds: number;
	}): void {
		const { contestants } = this;

		const deadContestants: Contestant[] = [];
		contestants.forEach(contestant => {
			if (contestant.monster.dead) {
				deadContestants.push(contestant);
			}

			contestant.killed = contestant.monster.killed;
			contestant.killedBy = contestant.monster.killedBy;
			contestant.fled = contestant.monster.fled;
			contestant.rounds = contestant.monster.round;
			contestant.encounter = contestant.monster.endEncounter();
		});
		const deaths = deadContestants.length;

		// Detect "last-team win via fled opponents" — all opponents fled but nobody died,
		// leaving exactly one surviving faction. Uses the same factionOf logic as
		// isLastTeamVictory so the two are consistent.
		//
		// Must require exactly one active (non-dead, non-fled) faction, not merely any
		// flee. If Slytherin flees but Hufflepuff is still fighting alongside Gryffindor,
		// two factions remain — isLastTeamFledWin must be false and the fight is a draw.
		const isLastTeamFledWin = (() => {
			if (this.ringEvent?.victoryMode !== 'last-team') return false;
			if (deaths > 0) return false;
			if (!contestants.some(c => c.fled)) return false;
			const activeSurvivors = contestants.filter(c => !c.monster.dead && !c.fled);
			if (activeSurvivors.length === 0) return false;
			const activeFactions = new Set(activeSurvivors.map(factionOf));
			return activeFactions.size === 1;
		})();

		// A decisive win requires an actual last contestant / last team — not merely
		// "someone died." The round-10 empty-deck path announces a draw with
		// lastContestant=undefined; if deaths>0 and multiple factions (or multiple
		// individuals) are still alive, awarding win to every survivor produced the
		// absurd fight-log outcome "win with survivors on both sides."
		const living = contestants.filter(c => !c.monster.dead && !c.fled);
		const isLastTeam = this.ringEvent?.victoryMode === 'last-team';
		// Classic (last-contestant) mode only records a win when someone actually died and
		// exactly one contestant remains — a pure flee with zero deaths stays a draw for
		// W/L (XP still flows through calculateXP). Last-team mode wins whenever exactly
		// one living faction remains (including the fled-with-zero-deaths path above).
		const hasDecisiveWinner =
			isLastTeamFledWin ||
			(living.length > 0 &&
				(isLastTeam
					? new Set(living.map(factionOf)).size === 1
					: deaths > 0 && living.length === 1));

		// Emit for battle history
		this.eventBus.publish({
			type: 'ring.fight',
			scope: 'public',
			text: `Fight concluded: ${deaths} dead after ${rounds} ${rounds === 1 ? 'round' : 'rounds'}`,
			payload: {
				contestants,
				deadContestants,
				deaths,
				lastContestant,
				rounds,
				eventName: 'fightConcludes',
			},
		});

		const xpBefore = contestants.map(c => c.monster.xp as number);
		contestants.forEach(contestant => {
			this.awardMonsterXP(contestant, contestants);
		});
		const xpGained = contestants.map((c, i) => (c.monster.xp as number) - (xpBefore[i] ?? 0));

		contestants.forEach((contestant, i) => {
			const { userId } = contestant;
			const xpDelta = xpGained[i] ?? 0;

			if (contestant.monster.dead) {
				// Deaths are always losses, even on an otherwise inconclusive (draw) fight.
				contestant.lost = true;

				if (contestant.monster.destroyed) {
					this.eventBus.publish({
						type: 'ring.permaDeath',
						scope: 'private',
						targetUserId: userId,
						text: `${contestant.monster.givenName} was too badly injured to be revived.`,
						payload: { contestant, xpGained: xpDelta },
					});
				} else {
					this.eventBus.publish({
						type: 'ring.loss',
						scope: 'private',
						targetUserId: userId,
						text: `${contestant.monster.givenName} has fallen in the fight. You may now \`revive\` or \`dismiss\` ${contestant.monster.pronouns.him}.`,
						payload: { contestant, xpGained: xpDelta },
					});
				}
			} else if (contestant.fled) {
				this.eventBus.publish({
					type: 'ring.fled',
					scope: 'private',
					targetUserId: userId,
					text: `${contestant.monster.givenName} lived to fight another day!`,
					payload: { contestant, xpGained: xpDelta },
				});
			} else if (hasDecisiveWinner) {
				contestant.won = true;

				this.eventBus.publish({
					type: 'ring.win',
					scope: 'private',
					targetUserId: userId,
					text: `${contestant.monster.identity} is victorious!`,
					payload: { contestant, xpGained: xpDelta },
				});
			} else {
				this.eventBus.publish({
					type: 'ring.draw',
					scope: 'private',
					targetUserId: userId,
					text: 'The fight ended in a draw.',
					payload: { contestant, xpGained: xpDelta },
				});
			}
		});

		let winnerMonsterId: string | undefined;
		let winnerMonsterName: string | undefined;
		let winnerOwnerUserId: string | undefined;
		let loserMonsterId: string | undefined;
		let loserMonsterName: string | undefined;
		let loserOwnerUserId: string | undefined;
		if (hasDecisiveWinner || deaths > 0) {
			// Attribute by outcome rather than by contestant count. The old `length === 2`
			// gate meant every multi-party fight lost its winner/loser entirely — which ring
			// events (multi-boss gauntlets, team battles) now make the common case. Stay
			// conservative: only claim an identity when exactly one contestant holds it.
			const winners = contestants.filter(c => c.won);
			const losers = contestants.filter(c => c.lost);

			if (winners.length === 1) {
				const [w] = winners;
				winnerMonsterId = w.monster.stableId;
				winnerMonsterName = w.monster.givenName;
				winnerOwnerUserId = w.userId;
			}

			if (losers.length === 1) {
				const [l] = losers;
				loserMonsterId = l.monster.stableId;
				loserMonsterName = l.monster.givenName;
				loserOwnerUserId = l.userId;
			}
		}

		const participants = contestants.map((c, i) => {
			const m = c.monster;
			const ch = c.character;
			return {
				monsterId: m.stableId as string,
				monsterName: m.givenName as string,
				monsterType: (m.constructor?.name ?? 'Monster') as string,
				// For the web's sprites in the fight history (roadmap 24): a fight replayed after
				// a reload has no roster to learn its monsters from, only this row. Additive and
				// JSON-safe; rows written before these fields simply keep their emoji.
				monsterIcon: (m.icon ?? '') as string,
				monsterCreatureType: (m.creatureType ?? '') as string,
				monsterAppearance: typeof m.color === 'string' ? m.color.slice(0, SNAPSHOT_APPEARANCE_MAX) : '',
				monsterAppearanceHex: appearanceHexOf(m),
				ownerUserId: c.userId as string,
				ownerDisplayName: (ch.givenName ?? ch.name ?? '') as string,
				outcome: participantOutcome(c, hasDecisiveWinner),
				xpGained: xpGained[i] ?? 0,
				level: m.level as number,
			};
		});

		// Only the final `win` arm should depend on decisiveness — gating the whole chain
		// on it (as the first cut of #74 did) silently downgraded two conclusive outcomes
		// to 'draw': a permanently destroyed monster, and "someone died, the survivor
		// fled". Both are real results and were labelled correctly before #74.
		//
		// `settled` is what keeps the fled arm honest: a fight where everyone fled and
		// nobody died is still a draw, not a flee. permaDeath needs no such guard —
		// destroyed implies dead, so `deaths > 0` already holds.
		const settled = deaths > 0 || hasDecisiveWinner;
		const fightOutcome = contestants.some(c => c.monster.destroyed)
			? 'permaDeath'
			: settled && contestants.some(c => c.fled)
				? 'fled'
				: hasDecisiveWinner
					? 'win'
					: 'draw';

		this.eventBus.publish({
			type: 'ring.fightResolved',
			scope: 'public',
			text: `Fight resolved (${fightOutcome})`,
			payload: {
				rounds,
				deaths,
				outcome: fightOutcome,
				ringEvent: this.ringEvent?.name ?? null,
				participants,
				winnerMonsterId,
				winnerMonsterName,
				winnerOwnerUserId,
				loserMonsterId,
				loserMonsterName,
				loserOwnerUserId,
			},
		});

		this.emit('fightConcludes', {
			contestants,
			deadContestants,
			deaths,
			// The announcement names the winner from this. Derived from the same
			// `c.won` flags that drive the fight log and leaderboard, so the banner
			// can never disagree with the recorded result.
			winners: contestants
				.filter(c => c.won)
				.map(c => ({ monsterName: c.monster.givenName as string, team: c.team ?? null })),
			// Derived from fightOutcome so the announcement can never disagree with the
			// fight log. The old `deaths <= 0` made a round-cap fight with deaths but
			// survivors on both sides announce "with N dead" while every other record
			// classed it a draw (#74).
			isDraw: fightOutcome === 'draw',
			lastContestant,
			rounds,
		});
	}

	awardMonsterXP(contestant: Contestant, contestants: Contestant[]): void {
		const { monster, killed } = contestant;
		const { gainedXP, reasons } = calculateXP(contestant as any, contestants as any);

		if (gainedXP > 0) {
			monster.xp += gainedXP;

			this.emit('gainedXP', {
				contestant,
				creature: monster,
				killed,
				xpGained: gainedXP,
				reasons,
			});
		}
	}

	handleWinner({ contestant }: { contestant: Contestant }): void {
		contestant.character.addWin();
		contestant.monster.addWin();
		this.emit('win', { contestant });
		contestant.monster.emit('win', { contestant });
	}

	handleLoser({ contestant }: { contestant: Contestant }): void {
		contestant.character.addLoss();
		contestant.monster.addLoss();
		this.emit('loss', { contestant });
		contestant.monster.emit('loss', { contestant });
	}

	handlePermaDeath({ contestant }: { contestant: Contestant }): void {
		contestant.character.dropMonster(contestant.monster);
		contestant.character.addLoss();
		this.emit('permaDeath', { contestant });
		// Unlike the win/loss/fled siblings above, this call was previously missing —
		// Game.initializeEvents() listens for the global `creature.permaDeath`
		// broadcast (emitted via BaseClass.emit's `${eventPrefix}.${event}` naming) to
		// award the player's permaDeath consolation XP/coins in Game.handlePermaDeath.
		// Without this line that listener never fired, so a permanently destroyed
		// monster granted its owner no reward at all — not even a normal loss amount.
		contestant.monster.emit('permaDeath', { contestant });
	}

	handleTied({ contestant }: { contestant: Contestant }): void {
		contestant.character.addDraw();
		contestant.monster.addDraw();
		this.emit('draw', { contestant });
		contestant.monster.emit('draw', { contestant });
	}

	handleFled({ contestant }: { contestant: Contestant }): void {
		contestant.character.addDraw();
		contestant.monster.addDraw();
		this.emit('fled', { contestant });
		contestant.monster.emit('fled', { contestant });
	}

	private getPlayerMonsterLevels(): number[] {
		return this.contestants
			.filter(contestant => !contestant.isBoss)
			.map(contestant => Number(contestant.monster?.level ?? 0))
			.filter(level => Number.isFinite(level) && level >= 0);
	}

	private getRoomMonsterLevels(): number[] {
		const levels = this.roomMonsterLevelsProvider?.() ?? [];
		return levels
			.map(level => Number(level))
			.filter(level => Number.isFinite(level) && level >= 0);
	}

	private getPreferredBossScalingLevels(): number[] {
		const ringLevels = this.getPlayerMonsterLevels();
		if (ringLevels.length > 0) return ringLevels;
		return this.getRoomMonsterLevels();
	}

	/**
	 * Boss timing remains ring-focused so room-level fallback only changes boss level
	 * selection, not spawn cadence. If the ring is empty we keep beginner pacing.
	 */
	private isBeginnerBossTimingContext(): boolean {
		const ringLevels = this.getPlayerMonsterLevels();
		return ringLevels.length === 0 || ringLevels.every(level => level <= BEGINNER_LEVEL_THRESHOLD);
	}

	private getBossSpawnOuterDelayMs(): number {
		if (this.isBeginnerBossTimingContext()) {
			return random(BOSS_SPAWN_BEGINNER_MIN_DELAY_MS, BOSS_SPAWN_BEGINNER_MAX_DELAY_MS);
		}
		return random(BOSS_SPAWN_MIN_DELAY_MS, BOSS_SPAWN_MAX_DELAY_MS);
	}

	private determineBossLevelCap(playerLevels: number[], roll: number): number | undefined {
		if (roll <= BOSS_FULL_RANDOM_WEIGHT_PERCENT) {
			return undefined;
		}

		if (playerLevels.length <= 0) {
			// When no ring/room monsters are known, capped branches collapse to beginner cap.
			return 0;
		}

		const highestLevel = Math.max(...playerLevels);
		if (roll <= BOSS_FULL_RANDOM_WEIGHT_PERCENT + BOSS_HIGHEST_PLUS_ONE_WEIGHT_PERCENT) {
			return Math.max(0, highestLevel + 1);
		}

		const averageLevel = playerLevels.reduce((sum, level) => sum + level, 0) / playerLevels.length;
		return Math.max(0, Math.floor(averageLevel));
	}

	private getBossLevelCap(): number | undefined {
		return this.determineBossLevelCap(this.getPreferredBossScalingLevels(), random(1, 100));
	}

	private getSpawnedBossContestant(): Contestant {
		const levelCap = this.getBossLevelCap();
		if (levelCap === undefined) {
			return randomContestant();
		}

		const maxXp = getXpCapForLevel(levelCap);
		return randomContestant({ xp: random(0, maxXp) });
	}

	/** Bosses currently in the ring. */
	get bossCount(): number {
		return this.contestants.reduce(
			(total, contestant) => total + (contestant.isBoss ? 1 : 0),
			0
		);
	}

	/**
	 * Whether another boss can enter the ring right now, and why not if it can't. Callers
	 * that charge the player for a summon should check this *before* spending the charge.
	 */
	canAcceptBoss(): { ok: true } | { ok: false; reason: BossRefusalReason } {
		if (this.inEncounter) return { ok: false, reason: 'in_encounter' };
		if (this.bossCount >= MAX_BOSSES) return { ok: false, reason: 'boss_cap' };
		if (this.contestants.length >= MAX_MONSTERS) return { ok: false, reason: 'ring_full' };
		return { ok: true };
	}

	/**
	 * Called when a player-summoned boss is removed before a fight starts (last player
	 * withdrew, or despawn timer fired with no players in ring). The game wires this to
	 * `_refundSingleBossSummon(userId, timestamp)` so the charge is returned from the
	 * `bossSummons` and `bossSummonsPending` ledgers. Not set for timer/admin/Gauntlet bosses.
	 * See docs/architecture/boss-encounters.md §3.
	 */
	onSummonedBossRemoved?: (userId: string, timestamp: number) => void;

	/**
	 * Whether the current ring event is a free-for-all (Blood Feud). Cards that call
	 * `getTarget` internally pass `ring` to it; this getter provides the policy without
	 * requiring cards to know about specific event names. See
	 * docs/architecture/boss-encounters.md §5.
	 */
	get encounterFreeForAll(): boolean {
		return this.ringEvent?.freeForAll === true;
	}

	/**
	 * Activates a ring event: sets it, emits the `ringEvent` announcement (consumed by
	 * the announcements module and the metrics collector), and spawns any extra bosses
	 * declared by the event (e.g. the Gauntlet's two bosses) with `deferFightTimer: true`
	 * so they don't arm a second fight timer on top of the one the caller manages.
	 *
	 * This is the single activation path shared by the natural roll (inside
	 * `startFightTimer`) and the admin `trigger ring event` command — keeping both
	 * paths identical prevents them from drifting apart. See
	 * docs/architecture/boss-encounters.md §4.
	 */
	activateRingEvent(ringEvent: RingEventDefinition): void {
		// Guard against repeat activation: overwriting an already-armed event would
		// re-run its side effects (boss spawns, announcements, metrics) and corrupt
		// the fight log. Natural rolls never reach here twice (rollRingEvent() bails
		// when this.ringEvent is set), so this guard is primarily for the admin
		// "trigger ring event" command path. See docs/architecture/boss-encounters.md §4.
		if (this.ringEvent) {
			this.log({
				context: 'ring.activateRingEvent.alreadyArmed',
				existing: this.ringEvent.id,
				refused: ringEvent.id,
			});
			return;
		}

		this.ringEvent = ringEvent;
		this.emit('ringEvent', { ringEvent });

		for (let i = 0; i < (ringEvent.extraBosses ?? 0); i++) {
			if (!this.canAcceptBoss().ok) break;
			this.spawnBoss({ deferFightTimer: true });
		}
	}

	/**
	 * Rolls for a ring event while the fight countdown is being armed.
	 *
	 * Only rolls when no event is already in force (after the eligibility re-check below),
	 * which is what stops the Gauntlet's boss spawns from recursing back into another roll.
	 * Spawns are deferred so the enclosing `startFightTimer()` arms exactly one fight timer.
	 *
	 * Eligibility re-check (correctness invariant, not randomness):
	 * A roster change during the countdown can invalidate an armed event — e.g. House War
	 * requires bossCount === 0, so a boss joining mid-countdown must clear it. This check
	 * runs before the deterministic/ringEventsEnabled guards so it applies even in test mode.
	 */
	private rollRingEvent(): void {
		const context = buildRingEventContext(this.contestants);
		const playersHaveAssignedTeams = this.contestants
			.filter(contestant => !contestant.isBoss)
			.some(contestant => Boolean(
				contestant.team || contestant.monster.team || contestant.character.team
			));

		/*
		 * Roster fairness is an invariant, not another random event. Evaluate it before
		 * preserving an armed event: a second boss can join while Blood Feud or The
		 * Reckoning is still eligible. Do not replace player-authored teams, though;
		 * those are an explicit matchup choice and already give targeting a faction.
		 */
		if (
			this.ringEventsEnabled
			&& !this.inEncounter
			&& context.bossCount >= 2
			&& context.playerCount >= 2
			&& !playersHaveAssignedTeams
		) {
			const commonCause = getRingEvent('common-cause');
			if (commonCause && this.ringEvent?.id !== commonCause.id) {
				if (this.ringEvent) {
					this.log({
						context: 'ring.rollRingEvent.multiBossFairnessOverride',
						cleared: this.ringEvent.id,
					});
					this.ringEvent = undefined;
				}
				this.activateRingEvent(commonCause);
			}
			return;
		}

		// If an event is already armed, verify it is still eligible for the current roster.
		// A roster change (boss joins, player leaves/rejoins) can make a previously-valid
		// event ineligible. Clear it so a fresh roll happens below (or nothing, in
		// deterministic/events-disabled mode — either is correct; the stale event is gone).
		if (this.ringEvent) {
			if (this.ringEvent.eligible(buildRingEventContext(this.contestants))) {
				return; // Still valid — keep the armed event, do not re-roll.
			}
			// Stale — clear before attempting a re-roll.
			this.log({
				context: 'ring.rollRingEvent.ineligibleRosterChange',
				cleared: this.ringEvent.id,
			});
			this.ringEvent = undefined;
		}

		if (!this.ringEventsEnabled) return;
		if (this.inEncounter) return;

		// Same escape hatch as the contestant shuffle: ring events are a randomness source,
		// so reproducible runs (tests, harness, balance sim) need them off.
		if (process.env.DECK_MONSTERS_DETERMINISTIC_RING) return;
		if (random(1, 100) > RING_EVENT_CHANCE_PERCENT) return;

		const ringEvent = selectRingEvent(context);
		if (!ringEvent) return;

		this.activateRingEvent(ringEvent);
	}

	startBossTimer(): void {
		const ring = this;

		if (this.spawnBosses) {
			const outerDelay = this.getBossSpawnOuterDelayMs();
			this.nextBossSpawnAt = Date.now() + outerDelay + BOSS_WARNING_DELAY_MS;
			this.publishState();

			this.bossTimer = setTimeout(() => {
				this.bossTimer = undefined;
				// Whether the ring could take a boss when the warning was due. If it couldn't,
				// no warning goes out — so the spawn two minutes later must be suppressed too,
				// or a fight ending inside the warning window produces an unannounced boss.
				const wasWarned = ring.canAcceptBoss().ok;
				if (wasWarned) {
					ring.emit('bossWillSpawn', { delay: BOSS_WARNING_DELAY_MS });
				}

				this.bossTimer = setTimeout(() => {
					this.bossTimer = undefined;
					ring.nextBossSpawnAt = null;
					ring.publishState();
					if (wasWarned) {
						ring.spawnBoss();
					}
					ring.startBossTimer();
				}, BOSS_WARNING_DELAY_MS);
			}, outerDelay);
		}
	}

	spawnBoss({
		deferFightTimer,
		summonedByUserId,
		summonedAt,
	}: {
		deferFightTimer?: boolean;
		/** Set by `summon a boss` so a pre-fight removal can refund the charge. */
		summonedByUserId?: string;
		summonedAt?: number;
	} = {}): Contestant | undefined {
		if (!this.canAcceptBoss().ok) return undefined;

		const contestant = this.getSpawnedBossContestant();

		this.addMonster({ ...contestant, deferFightTimer, summonedByUserId, summonedAt });

		if (random(1)) {
			const ring = this;
			const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
				ring.bossDespawnTimers.delete(timer);
				// removeMonster() (called via removeBoss) rejects if the boss is no
				// longer in the ring — defensive catch for races where the timer
				// fires in the same tick as clearRing()/dispose() draining the set.
				ring.removeBoss(contestant).catch(() => {});
			}, BOSS_DESPAWN_DELAY_MS);
			this.bossDespawnTimers.add(timer);
		}

		return contestant;
	}

	removeBoss(contestant: Contestant): Promise<void> {
		// Despawn whenever no player monster is left to fight, not just when this boss is the
		// sole contestant. Two or more bosses alone never trigger a fight either (they count
		// as one monster for the quorum in startFightTimer), so the old `length === 1` check
		// let an idle ring silently accumulate bosses up to MAX_BOSSES forever.
		const hasPlayerContestants = this.contestants.some(({ isBoss }) => !isBoss);

		if (!this.inEncounter && !hasPlayerContestants) {
			// For player-summoned bosses: find the actual ring contestant (which carries the
			// summonedByUserId set in addMonster) and refund before removal.
			const ringContestant = this.findContestant(contestant.character, contestant.monster);
			if (
				ringContestant?.summonedByUserId !== undefined &&
				ringContestant?.summonedAt !== undefined
			) {
				this.onSummonedBossRemoved?.(ringContestant.summonedByUserId, ringContestant.summonedAt);
			}
			return this.removeMonster(contestant as any);
		}

		return Promise.resolve();
	}
}

export default Ring;
