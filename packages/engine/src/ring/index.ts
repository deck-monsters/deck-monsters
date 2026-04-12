import { BaseClass } from '../shared/baseClass.js';
import { random, shuffle } from '../helpers/random.js';
import { actionCard, monsterCard } from '../helpers/card.js';
import { calculateXP } from '../helpers/experience.js';
import { getTarget } from '../helpers/targeting-strategies.js';
import { randomContestant } from '../helpers/bosses.js';
import { getLevel } from '../helpers/levels.js';
import { sortCardsAlphabetically } from '../cards/helpers/sort.js';
import { shortDelay, veryShortDelay } from '../helpers/delay-times.js';
import { uniqueCards } from '../cards/helpers/unique-cards.js';
import type { RoomEventBus } from '../events/index.js';

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

/**
 * Calculates the max XP that still maps to `targetLevel` via `getLevel()`.
 * Level 0 cap is 49, level 1 cap is 99, level 2 cap is 149, etc.
 */
const getXpCapForLevel = (targetLevel: number): number => {
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

export interface Contestant {
	monster: any;
	character: any;
	userId: string;
	isBoss?: boolean;
	won?: boolean;
	lost?: boolean;
	fled?: boolean;
	killed?: any;
	killedBy?: any;
	rounds?: number;
	encounter?: any;
	round?: number;
}

function participantOutcome(contestant: Contestant, deaths: number): 'win' | 'loss' | 'draw' | 'fled' | 'permaDeath' {
	if (deaths <= 0) return 'draw';
	if (contestant.monster.destroyed) return 'permaDeath';
	if (contestant.monster.dead) return 'loss';
	if (contestant.fled) return 'fled';
	return 'win';
}

export class Ring extends BaseClass {
	static eventPrefix = 'ring';

	log: (err: unknown) => void;
	spawnBosses: boolean;
	eventBus: RoomEventBus;
	private readonly roomMonsterLevelsProvider?: () => number[];
	inEncounter: boolean = false;
	encounter?: Record<string, any>;
	fightTimer?: ReturnType<typeof setTimeout>;
	bossTimer?: ReturnType<typeof setTimeout>;
	/** Epoch ms when the next boss will enter the ring (including the 2-min announcement window), or null if no timer is running. */
	nextBossSpawnAt: number | null = null;
	/** Epoch ms when the next fight will start, or null if no fight timer is active. */
	nextFightAt: number | null = null;

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
			getRoomMonsterLevels,
			...options
		}: { spawnBosses?: boolean; getRoomMonsterLevels?: () => number[]; [key: string]: unknown } = {},
		log: (err: unknown) => void = () => {}
	) {
		super(options);

		this.log = log;
		this.spawnBosses = spawnBosses;
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
					this.pub('announce', 'You cannot withdraw while an encounter is in progress', {}, userId);
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
				const contestantIndex = this.contestants.indexOf(contestant);

				this.contestants.splice(contestantIndex, 1);

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
			});
	}

	addMonster({
		monster,
		character,
		userId,
		isBoss,
	}: {
		monster: any;
		character: any;
		userId: string;
		isBoss?: boolean;
	}): void {
		if (this.contestants.length < MAX_MONSTERS && !this.inEncounter) {
			const contestant: Contestant = {
				monster,
				character,
				userId,
				isBoss,
			};

			this.contestants = shuffle([...this.contestants, contestant]);

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

			if (this.contestants.length > MAX_MONSTERS) {
				this.clearRing();
			} else {
				this.emit('add', { contestant });
				this.startFightTimer();
			}
		} else {
			this.pub(
				'announce',
				'The ring is full! Wait until the current battle is over and try again.',
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
			this.pub('announce', 'Wait until the encounter has started.', {}, userId);
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

		this.inEncounter = true;
		this.encounter = {};
		this.contestants.forEach(({ userId, monster }) => {
			monster.startEncounter(this);

			this.pub(
				'announce',
				'The fight has begun! You may now type `look at monsters in the ring` to see all participants with their current stats, and `look at cards in the ring` to see the detailed stats of every card that will be in play.',
				{},
				userId
			);
		});

		return true;
	}

	endEncounter(): void {
		this.contestants.forEach(contestant => contestant.monster.endEncounter());
		this.inEncounter = false;
		delete this.encounter;
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
			},
		});
	}

	clearRing(): void {
		clearTimeout(this.fightTimer);
		this.fightTimer = undefined;
		this.nextFightAt = null;
		this.endEncounter();
		for (const { monster, character } of this.contestants) {
			(monster as { disposeTimers?: () => void })?.disposeTimers?.();
			(character as { disposeTimers?: () => void })?.disposeTimers?.();
		}
		this.contestants = [];
		this.emit('clear');
		this.publishState();
	}

	dispose(): void {
		clearTimeout(this.fightTimer);
		clearTimeout(this.bossTimer);
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
			this.emit('narration', {
				narration: 'The ring is quiet save for the faint sound of footsteps fleeing into the distance.',
			});
			this.publishState();
		} else {
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

		this.emit('fight', { contestants });

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

				if (activeContestants.length <= 1) {
					nextCardIndex += 1;

					if (activeContestants.length === 1) {
						activeContestants = [...activeContestants, ...getAllActiveContestants()];
					} else {
						activeContestants = getAllActiveContestants();
						next();
						return;
					}
				}

				const playerContestant = activeContestants.shift()!;
				const { monster: player } = playerContestant;
				const card = player.cards[cardIndex];

				if (card) {
					if (turn !== cardIndex) {
						turn = cardIndex;

						this.emit('startTurn', {
							turn,
							contestants: getAllActiveContestants(),
							round,
						});
					}

					this.emit('playerTurnBegin', { contestant: playerContestant, round });

					const targetContestant = getTarget({
						contestants: getAllActiveContestants(),
						playerContestant,
						strategy: playerContestant.monster.targetingStrategy,
					}) as Contestant;
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
					if (getAllActiveContestants().length > 1) {
						setTimeout(() => next(), veryShortDelay(round));
					} else {
						resolve(playerContestant);
					}
					return;
				}

				card
					.play(player, proposedTarget, ring, getAllActiveContestants())
					.then(() => {
						if (getAllActiveContestants().length > 1) {
							const waitMs = veryShortDelay(round);
							return new Promise<void>(r => setTimeout(r, waitMs)).then(() => next());
						}

						return Promise.resolve().then(() => resolve(playerContestant));
					})
					.catch((ex: unknown) => {
						this.log({
							err: ex,
							context: 'card.play',
							card: card.name,
							player: player.givenName,
							target: proposedTarget.givenName,
						});
						// Skip the failed card and continue the fight rather than crashing
						if (getAllActiveContestants().length > 1) {
							return new Promise<void>(r => setTimeout(r, veryShortDelay(round))).then(() => next());
						}
						return Promise.resolve().then(() => resolve(playerContestant));
					});
				} else {
					this.emit('endOfDeck', { contestant: playerContestant, round });

					player.emptyHanded = true;

					const allActiveContestants = getAllActiveContestants();
					if (!anyContestantsHaveCardsLeft(allActiveContestants)) {
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

					const waitMs = shortDelay(round);
					setTimeout(() => next(), waitMs);
				}
			});

		return doAction()
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

		// Emit for battle history
		this.eventBus.publish({
			type: 'ring.fight',
			scope: 'public',
			text: `Fight concluded: ${deaths} dead after ${rounds} rounds`,
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

			if (deaths > 0) {
				if (contestant.monster.dead) {
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
							text: `${contestant.monster.givenName} has died in battle. You may now \`revive\` or \`dismiss\` ${contestant.monster.pronouns.him}.`,
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
				} else {
					contestant.won = true;

					this.eventBus.publish({
						type: 'ring.win',
						scope: 'private',
						targetUserId: userId,
						text: `${contestant.monster.identity} is victorious!`,
						payload: { contestant, xpGained: xpDelta },
					});
				}
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
		if (contestants.length === 2 && deaths > 0) {
			const w = contestants.find(c => c.won);
			const l = contestants.find(c => c.lost);
			if (w && l) {
				winnerMonsterId = w.monster.stableId;
				winnerMonsterName = w.monster.givenName;
				winnerOwnerUserId = w.userId;
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
				ownerUserId: c.userId as string,
				ownerDisplayName: (ch.givenName ?? ch.name ?? '') as string,
				outcome: participantOutcome(c, deaths),
				xpGained: xpGained[i] ?? 0,
				level: m.level as number,
			};
		});

		const fightOutcome =
			deaths <= 0
				? 'draw'
				: contestants.some(c => c.monster.destroyed)
					? 'permaDeath'
					: contestants.some(c => c.fled)
						? 'fled'
						: 'win';

		this.eventBus.publish({
			type: 'ring.fightResolved',
			scope: 'public',
			text: `Fight resolved (${fightOutcome})`,
			payload: {
				rounds,
				deaths,
				outcome: fightOutcome,
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
			isDraw: deaths <= 0,
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

	startBossTimer(): void {
		const ring = this;

		if (this.spawnBosses) {
			const outerDelay = this.getBossSpawnOuterDelayMs();
			this.nextBossSpawnAt = Date.now() + outerDelay + BOSS_WARNING_DELAY_MS;
			this.publishState();

			this.bossTimer = setTimeout(() => {
				this.bossTimer = undefined;
				const numberOfBossesInRing = ring.contestants.reduce(
					(total, contestant) => total + (contestant.isBoss ? 1 : 0),
					0
				);
				if (!ring.inEncounter && numberOfBossesInRing < MAX_BOSSES) {
					ring.emit('bossWillSpawn', { delay: BOSS_WARNING_DELAY_MS });
				}

				this.bossTimer = setTimeout(() => {
					this.bossTimer = undefined;
					ring.nextBossSpawnAt = null;
					ring.publishState();
					if (!ring.inEncounter) {
						ring.spawnBoss();
					}
					ring.startBossTimer();
				}, BOSS_WARNING_DELAY_MS);
			}, outerDelay);
		}
	}

	spawnBoss(): Contestant | undefined {
		const numberOfBossesInRing = this.contestants.reduce(
			(total, contestant) => total + (contestant.isBoss ? 1 : 0),
			0
		);

		if (!this.inEncounter && numberOfBossesInRing < MAX_BOSSES) {
			const contestant = this.getSpawnedBossContestant();

			this.addMonster(contestant);

			if (random(1)) {
				const ring = this;
				setTimeout(() => {
					ring.removeBoss(contestant);
				}, BOSS_DESPAWN_DELAY_MS);
			}

			return contestant;
		}

		return undefined;
	}

	removeBoss(contestant: Contestant): Promise<void> {
		if (!this.inEncounter && this.contestants.length === 1) {
			return this.removeMonster(contestant as any);
		}

		return Promise.resolve();
	}
}

export default Ring;
